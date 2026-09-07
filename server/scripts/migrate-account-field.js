require('dotenv').config();
const mysql = require('mysql2/promise');

const database = process.env.DB_NAME || 'curva_fabric_b2b';
const legacyColumn = ['user', 'name'].join('_');
const legacyProperty = ['user', 'Name'].join('');
const legacyPath = `$.${legacyProperty}`;
const legacyIndex = ['idx', 'users', 'user', 'name'].join('_');

async function columnExists(connection, table, column) {
  const [[row]] = await connection.query(
    'SELECT COUNT(*) count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
    [database, table, column]
  );
  return Number(row.count) > 0;
}

async function constraintExists(connection, table, constraint) {
  const [[row]] = await connection.query(
    'SELECT COUNT(*) count FROM information_schema.table_constraints WHERE constraint_schema = ? AND table_name = ? AND constraint_name = ?',
    [database, table, constraint]
  );
  return Number(row.count) > 0;
}

async function migrateJsonField(connection, table, dataColumn, oldPath, newPath) {
  await connection.query(
    `UPDATE \`${table}\`
        SET \`${dataColumn}\` = JSON_REMOVE(
          JSON_SET(\`${dataColumn}\`, ?, JSON_UNQUOTE(JSON_EXTRACT(\`${dataColumn}\`, ?))),
          ?
        )
      WHERE JSON_CONTAINS_PATH(\`${dataColumn}\`, 'one', ?)`,
    [newPath, oldPath, oldPath, oldPath]
  );
}

async function main() {
  if (!process.env.DB_USER) throw new Error('DB_USER is required.');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    charset: 'utf8mb4',
  });
  const lockName = `${database}:migrate-account-field`;
  let hasLock = false;
  try {
    const [[lock]] = await connection.query('SELECT GET_LOCK(?, 30) acquired', [lockName]);
    if (Number(lock.acquired) !== 1) throw new Error('Could not acquire the account migration lock.');
    hasLock = true;

    const hasOldUsersColumn = await columnExists(connection, 'users', legacyColumn);
    const hasAccountColumn = await columnExists(connection, 'users', 'account');
    if (hasOldUsersColumn && hasAccountColumn) throw new Error('users contains both legacy identity and account columns; resolve the ambiguous schema manually.');

    if (hasOldUsersColumn) {
      const [[invalid]] = await connection.query(
        'SELECT COUNT(*) count FROM users WHERE JSON_UNQUOTE(JSON_EXTRACT(user_data, ?)) IS NULL OR CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(user_data, ?))) NOT BETWEEN 1 AND 255',
        [legacyPath, legacyPath]
      );
      if (Number(invalid.count)) throw new Error(`${invalid.count} users have an invalid legacy identity; no migration was performed.`);
      if (await constraintExists(connection, 'users', 'chk_users_json_identity')) {
        await connection.query('ALTER TABLE users DROP CHECK chk_users_json_identity');
      }
      await migrateJsonField(connection, 'users', 'user_data', legacyPath, '$.account');
      await connection.query(`ALTER TABLE users DROP INDEX \`${legacyIndex}\`, DROP COLUMN \`${legacyColumn}\`, ADD COLUMN account VARCHAR(255) GENERATED ALWAYS AS (LOWER(JSON_UNQUOTE(JSON_EXTRACT(user_data, '$.account')))) STORED AFTER user_data, ADD KEY idx_users_account (account)`);
      console.log('migrated users identity to users.account');
    }

    if (await columnExists(connection, 'quotes', legacyColumn)) {
      await migrateJsonField(connection, 'quotes', 'quote_data', legacyPath, '$.account');
      await migrateJsonField(connection, 'quotes', 'quote_data', `$.customer.${legacyProperty}`, '$.customer.account');
      await connection.query(`ALTER TABLE quotes DROP INDEX \`idx_quotes_${legacyColumn}\`, DROP COLUMN \`${legacyColumn}\`, ADD COLUMN account VARCHAR(255) GENERATED ALWAYS AS (LOWER(JSON_UNQUOTE(JSON_EXTRACT(quote_data, '$.account')))) STORED AFTER visitor_id, ADD KEY idx_quotes_account (account)`);
      console.log('migrated quotes identity to quotes.account');
    }

    await migrateJsonField(connection, 'support_conversations', 'conversation_data', `$.customer${legacyProperty[0].toUpperCase()}${legacyProperty.slice(1)}`, '$.customerAccount');
    await migrateJsonField(connection, 'support_conversation_messages', 'message_data', `$.sender${legacyProperty[0].toUpperCase()}${legacyProperty.slice(1)}`, '$.senderAccount');
    await migrateJsonField(connection, 'support_messages', 'message_data', legacyPath, '$.account');
    await migrateJsonField(connection, 'im_messages', 'message_data', `$.sender${legacyProperty[0].toUpperCase()}${legacyProperty.slice(1)}`, '$.senderAccount');
    await migrateJsonField(connection, 'user_events', 'event_data', legacyPath, '$.account');

    console.log('account field migration complete');
  } finally {
    if (hasLock) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
