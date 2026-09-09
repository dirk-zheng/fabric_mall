require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const days = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 30 && parsed <= 3650 ? parsed : fallback;
};

(async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME || 'curva_fabric_b2b',
    });
    const requiredTables = ['users', 'user_events', 'user_consents', 'admin_audit_log', 'quotes', 'support_conversations'];
    const [tables] = await connection.query('SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = ? AND table_name IN (?)', [process.env.DB_NAME || 'curva_fabric_b2b', requiredTables]);
    const installed = new Set(tables.map((row) => row.tableName));
    const [eventRows] = await connection.query(`SELECT COUNT(*) AS count FROM user_events WHERE occurred_at < CURRENT_TIMESTAMP - INTERVAL ${days(process.env.RETENTION_EVENT_DAYS, 180)} DAY`);
    const [messageRows] = await connection.query(`SELECT COUNT(*) AS count FROM support_messages WHERE created_at < CURRENT_TIMESTAMP - INTERVAL ${days(process.env.RETENTION_GUEST_CHAT_DAYS, 90)} DAY`);
    const [conversationRows] = await connection.query(`SELECT COUNT(*) AS count FROM support_conversations WHERE JSON_UNQUOTE(JSON_EXTRACT(conversation_data, '$.status')) IN ('closed', 'resolved') AND updated_at < CURRENT_TIMESTAMP - INTERVAL ${days(process.env.RETENTION_CLOSED_SUPPORT_DAYS, 365)} DAY`);
    const missing = requiredTables.filter((table) => !installed.has(table));
    console.log(JSON.stringify({ database: process.env.DB_NAME, schemaOk: missing.length === 0, missingTables: missing, retentionCandidates: { events: Number(eventRows[0].count), guestMessages: Number(messageRows[0].count), closedConversations: Number(conversationRows[0].count) } }, null, 2));
    if (missing.length) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally { await connection?.end(); }
})();
