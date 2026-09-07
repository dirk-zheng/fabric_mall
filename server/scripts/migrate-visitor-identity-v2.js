require('dotenv').config();
const mysql = require('mysql2/promise');

const database = process.env.DB_NAME || 'curva_fabric_b2b';
const suffix = '20260904';

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    'SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1',
    [database, tableName]
  );
  return rows.length > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    'SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [database, tableName, columnName]
  );
  return rows.length > 0;
}

async function backupTable(connection, tableName) {
  if (!await tableExists(connection, tableName)) return;
  const backupName = `${tableName}_backup_${suffix}`;
  if (!await tableExists(connection, backupName)) {
    await connection.query(`CREATE TABLE \`${backupName}\` AS SELECT * FROM \`${tableName}\``);
  }
}

async function alignVisitorIdWidths(connection) {
  for (const tableName of ['rfq_assortments', 'quotes']) {
    if (!await columnExists(connection, tableName, 'visitor_id')) continue;
    const [rows] = await connection.query(`SELECT COALESCE(MAX(CHAR_LENGTH(visitor_id)), 0) AS max_length FROM \`${tableName}\``);
    if (Number(rows[0].max_length) > 64) throw new Error(`${tableName}.visitor_id contains a value longer than 64 characters`);
  }
  if (await columnExists(connection, 'rfq_assortments', 'visitor_id')) {
    await connection.query('ALTER TABLE rfq_assortments MODIFY visitor_id VARCHAR(64) NOT NULL');
  }
  if (await columnExists(connection, 'quotes', 'visitor_id')) {
    await connection.query(`
      ALTER TABLE quotes MODIFY visitor_id VARCHAR(64) GENERATED ALWAYS AS
        (JSON_UNQUOTE(JSON_EXTRACT(quote_data, '$.visitorId'))) STORED
    `);
  }
}

async function ensureUserEvents(connection) {
  if (!await tableExists(connection, 'user_events')) {
    await connection.query(`
      CREATE TABLE user_events (
        visitor_id VARCHAR(64) NOT NULL,
        event_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        page_path VARCHAR(500) NULL,
        entity_type VARCHAR(64) NULL,
        entity_id VARCHAR(128) NULL,
        event_data JSON NULL,
        ip_hash CHAR(64) NULL,
        user_agent VARCHAR(500) NULL,
        occurred_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (visitor_id, event_id),
        KEY idx_user_events_visitor_time (visitor_id, occurred_at),
        KEY idx_user_events_type_time (event_type, occurred_at),
        KEY idx_user_events_event_id (event_id)
      ) ENGINE=InnoDB
    `);
  }
  if (await tableExists(connection, 'visitor_events')) {
    await connection.query(`
      INSERT IGNORE INTO user_events
        (visitor_id, event_id, event_type, page_path, entity_type, entity_id, event_data, occurred_at)
      SELECT visitor_id, event_id, event_type, page_path, entity_type, entity_id, event_data, occurred_at
        FROM visitor_events WHERE CHAR_LENGTH(visitor_id) <= 64
    `);
  }
}

async function archiveLegacyIdentityTables(connection) {
  for (const tableName of ['visitor_users', 'visitor_events']) {
    const archivedName = `${tableName}_identity_source_${suffix}`;
    if (!await tableExists(connection, tableName)) continue;
    if (!await tableExists(connection, archivedName)) {
      await connection.query(`RENAME TABLE \`${tableName}\` TO \`${archivedName}\``);
      continue;
    }
    let sequence = 1;
    let postMigrationName = `${archivedName}_post_migration`;
    while (await tableExists(connection, postMigrationName)) {
      sequence += 1;
      postMigrationName = `${archivedName}_post_migration_${sequence}`;
    }
    await connection.query(`RENAME TABLE \`${tableName}\` TO \`${postMigrationName}\``);
  }
}

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    multipleStatements: true,
  });

  try {
    if (await columnExists(connection, 'users', 'visitor_id')) {
      await alignVisitorIdWidths(connection);
      await ensureUserEvents(connection);
      await archiveLegacyIdentityTables(connection);
      console.log('Visitor identity schema is already active; no migration was needed.');
      return;
    }

    for (const table of ['users', 'visitor_users', 'visitor_events', 'user_profiles', 'rfq_assortments', 'quotes']) {
      await backupTable(connection, table);
    }

    await connection.query('DROP TABLE IF EXISTS `users_identity_v2`');
    await connection.query(`
      CREATE TABLE users_identity_v2 (
        visitor_id VARCHAR(64) NOT NULL,
        user_data JSON NOT NULL,
        user_name VARCHAR(255) GENERATED ALWAYS AS
          (LOWER(JSON_UNQUOTE(JSON_EXTRACT(user_data, '$.userName')))) STORED,
        role VARCHAR(32) GENERATED ALWAYS AS
          (JSON_UNQUOTE(JSON_EXTRACT(user_data, '$.role'))) STORED,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (visitor_id),
        KEY idx_users_user_name (user_name),
        KEY idx_users_role (role)
      ) ENGINE=InnoDB
    `);

    if (await tableExists(connection, 'visitor_users')) {
      await connection.query(`
        INSERT INTO users_identity_v2 (visitor_id, user_data, created_at, updated_at)
        SELECT v.visitor_id,
               JSON_MERGE_PATCH(
                 JSON_REMOVE(COALESCE(u.user_data, JSON_OBJECT()), '$.id', '$.username', '$.userId'),
                 COALESCE(v.visitor_data, JSON_OBJECT()),
                 JSON_OBJECT('visitorId', v.visitor_id, 'userName', LOWER(v.user_name))
               ),
               v.created_at, v.updated_at
          FROM visitor_users v
          LEFT JOIN users u ON u.user_name = v.user_name
         WHERE CHAR_LENGTH(v.visitor_id) <= 64 AND v.user_name IS NOT NULL
      `);
    }

    if (await columnExists(connection, 'users', 'user_name')) {
      await connection.query(`
        INSERT INTO users_identity_v2 (visitor_id, user_data, created_at, updated_at)
        SELECT CONCAT('legacy-', LEFT(SHA2(u.user_name, 256), 57)),
               JSON_MERGE_PATCH(
                 JSON_REMOVE(u.user_data, '$.id', '$.username', '$.userId'),
                 JSON_OBJECT(
                   'visitorId', CONCAT('legacy-', LEFT(SHA2(u.user_name, 256), 57)),
                   'userName', LOWER(u.user_name)
                 )
               ),
               u.created_at, u.updated_at
          FROM users u
         WHERE NOT EXISTS (SELECT 1 FROM users_identity_v2 n WHERE n.user_name = LOWER(u.user_name))
      `);
    } else {
      throw new Error('Unsupported users schema: expected user_name or visitor_id');
    }

    await connection.query(`RENAME TABLE users TO users_identity_source_${suffix}, users_identity_v2 TO users`);

    await connection.query('DROP TABLE IF EXISTS `user_profiles_identity_v2`');
    await connection.query(`
      CREATE TABLE user_profiles_identity_v2 (
        visitor_id VARCHAR(64) NOT NULL,
        profile_data JSON NOT NULL,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (visitor_id),
        CONSTRAINT fk_user_profiles_visitor_v2 FOREIGN KEY (visitor_id) REFERENCES users (visitor_id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    if (await tableExists(connection, 'user_profiles') && await columnExists(connection, 'user_profiles', 'user_name')) {
      await connection.query(`
        INSERT INTO user_profiles_identity_v2 (visitor_id, profile_data, updated_at)
        SELECT u.visitor_id, p.profile_data, p.updated_at
          FROM user_profiles p JOIN users u ON u.user_name = LOWER(p.user_name)
      `);
      await connection.query(`RENAME TABLE user_profiles TO user_profiles_identity_source_${suffix}, user_profiles_identity_v2 TO user_profiles`);
    } else {
      if (await tableExists(connection, 'user_profiles')) await connection.query(`RENAME TABLE user_profiles TO user_profiles_identity_source_${suffix}`);
      await connection.query('RENAME TABLE user_profiles_identity_v2 TO user_profiles');
    }

    await ensureUserEvents(connection);

    if (!await tableExists(connection, 'user_consents')) {
      await connection.query(`
        CREATE TABLE user_consents (
          consent_id VARCHAR(64) NOT NULL,
          visitor_id VARCHAR(64) NOT NULL,
          consent_type VARCHAR(64) NOT NULL,
          granted BOOLEAN NOT NULL,
          policy_version VARCHAR(32) NULL,
          consent_data JSON NULL,
          recorded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (consent_id),
          KEY idx_user_consents_visitor_type (visitor_id, consent_type)
        ) ENGINE=InnoDB
      `);
    }

    await alignVisitorIdWidths(connection);
    await archiveLegacyIdentityTables(connection);

    console.log('Visitor identity migration completed. Source and backup tables were retained.');
  } finally {
    await connection.end();
  }
}

migrate().catch((error) => {
  console.error(`Visitor identity migration failed: ${error.message}`);
  process.exitCode = 1;
});
