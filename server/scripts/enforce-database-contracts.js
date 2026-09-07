require('dotenv').config();
const mysql = require('mysql2/promise');

const database = process.env.DB_NAME || 'curva_fabric_b2b';

const validations = [
  ['users visitor_id format', "SELECT COUNT(*) count FROM users WHERE visitor_id NOT REGEXP '^[A-Za-z0-9-]{16,64}$'"],
  ['users JSON identity', "SELECT COUNT(*) count FROM users WHERE account IS NULL OR CHAR_LENGTH(account) NOT BETWEEN 1 AND 255 OR NOT (JSON_UNQUOTE(JSON_EXTRACT(user_data, '$.visitorId')) <=> visitor_id)"],
  ['user_events visitor_id format', "SELECT COUNT(*) count FROM user_events WHERE visitor_id NOT REGEXP '^[A-Za-z0-9-]{16,64}$'"],
  ['RFQ visitor_id format or JSON identity', "SELECT COUNT(*) count FROM rfq_assortments WHERE visitor_id NOT REGEXP '^[A-Za-z0-9-]{16,64}$' OR NOT (JSON_UNQUOTE(JSON_EXTRACT(assortment_data, '$.visitorId')) <=> visitor_id)"],
  ['orphan RFQ rows', 'SELECT COUNT(*) count FROM rfq_assortments r LEFT JOIN users u ON u.visitor_id = r.visitor_id WHERE u.visitor_id IS NULL'],
  ['IM JSON identity', "SELECT COUNT(*) count FROM im_rooms WHERE NOT (JSON_UNQUOTE(JSON_EXTRACT(room_data, '$.roomId')) <=> room_id)"],
  ['orphan or inconsistent IM messages', "SELECT COUNT(*) count FROM im_messages m LEFT JOIN im_rooms r ON r.room_id = m.room_id WHERE r.room_id IS NULL OR NOT (JSON_UNQUOTE(JSON_EXTRACT(m.message_data, '$.id')) <=> m.message_id) OR NOT (JSON_UNQUOTE(JSON_EXTRACT(m.message_data, '$.roomId')) <=> m.room_id)"],
  ['support conversation JSON identity', "SELECT COUNT(*) count FROM support_conversations WHERE NOT (JSON_UNQUOTE(JSON_EXTRACT(conversation_data, '$.id')) <=> conversation_id)"],
  ['orphan or inconsistent support messages', "SELECT COUNT(*) count FROM support_conversation_messages m LEFT JOIN support_conversations c ON c.conversation_id = m.conversation_id WHERE c.conversation_id IS NULL OR NOT (JSON_UNQUOTE(JSON_EXTRACT(m.message_data, '$.id')) <=> m.message_id) OR NOT (JSON_UNQUOTE(JSON_EXTRACT(m.message_data, '$.conversationId')) <=> m.conversation_id)"],
];

const constraints = [
  ['users', 'chk_users_visitor_id', "CHECK (visitor_id REGEXP '^[A-Za-z0-9-]{16,64}$')"],
  ['users', 'chk_users_account_identity', "CHECK (account IS NOT NULL AND CHAR_LENGTH(account) BETWEEN 1 AND 255 AND JSON_UNQUOTE(JSON_EXTRACT(user_data, '$.visitorId')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(user_data, '$.visitorId')) = visitor_id)"],
  ['user_events', 'chk_user_events_visitor_id', "CHECK (visitor_id REGEXP '^[A-Za-z0-9-]{16,64}$')"],
  ['rfq_assortments', 'chk_rfq_assortments_visitor_id', "CHECK (visitor_id REGEXP '^[A-Za-z0-9-]{16,64}$')"],
  ['rfq_assortments', 'chk_rfq_assortments_json_identity', "CHECK (JSON_UNQUOTE(JSON_EXTRACT(assortment_data, '$.visitorId')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(assortment_data, '$.visitorId')) = visitor_id)"],
  ['rfq_assortments', 'fk_rfq_assortments_visitor', 'FOREIGN KEY (visitor_id) REFERENCES users (visitor_id) ON DELETE CASCADE'],
  ['im_rooms', 'chk_im_rooms_json_identity', "CHECK (JSON_UNQUOTE(JSON_EXTRACT(room_data, '$.roomId')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(room_data, '$.roomId')) = room_id)"],
  ['im_messages', 'chk_im_messages_json_identity', "CHECK (JSON_UNQUOTE(JSON_EXTRACT(message_data, '$.id')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(message_data, '$.id')) = message_id AND JSON_UNQUOTE(JSON_EXTRACT(message_data, '$.roomId')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(message_data, '$.roomId')) = room_id)"],
  ['im_messages', 'fk_im_messages_room', 'FOREIGN KEY (room_id) REFERENCES im_rooms (room_id) ON DELETE CASCADE'],
  ['support_conversations', 'chk_support_conversations_json_identity', "CHECK (JSON_UNQUOTE(JSON_EXTRACT(conversation_data, '$.id')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(conversation_data, '$.id')) = conversation_id)"],
  ['support_conversation_messages', 'chk_support_conversation_messages_json_identity', "CHECK (JSON_UNQUOTE(JSON_EXTRACT(message_data, '$.id')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(message_data, '$.id')) = message_id AND JSON_UNQUOTE(JSON_EXTRACT(message_data, '$.conversationId')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(message_data, '$.conversationId')) = conversation_id)"],
  ['support_conversation_messages', 'fk_support_conversation_messages_conversation', 'FOREIGN KEY (conversation_id) REFERENCES support_conversations (conversation_id) ON DELETE CASCADE'],
];

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
  const lockName = `${database}:enforce-database-contracts`;
  let hasLock = false;
  try {
    const [[lock]] = await connection.query('SELECT GET_LOCK(?, 30) acquired', [lockName]);
    if (Number(lock.acquired) !== 1) throw new Error('Could not acquire the database contract migration lock.');
    hasLock = true;
    for (const [label, sql] of validations) {
      const [[row]] = await connection.query(sql);
      if (Number(row.count)) throw new Error(`${label} validation failed for ${row.count} row(s); no constraints were changed.`);
    }
    for (const [table, name, definition] of constraints) {
      const [[existing]] = await connection.query(
        'SELECT COUNT(*) count FROM information_schema.table_constraints WHERE constraint_schema = ? AND table_name = ? AND constraint_name = ?',
        [database, table, name]
      );
      if (Number(existing.count)) {
        console.log(`kept ${table}.${name}`);
        continue;
      }
      await connection.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` ${definition}`);
      console.log(`added ${table}.${name}`);
    }
  } finally {
    if (hasLock) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
