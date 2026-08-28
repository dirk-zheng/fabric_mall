const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

let mysql;
let pool;
let ready = false;
let lastError = null;

const TABLES = {
  users: { table: 'users', key: 'user_id', data: 'user_data' },
  quotes: { table: 'quotes', key: 'quote_id', data: 'quote_data' },
  rfqAssortments: { table: 'rfq_assortments', key: 'user_id', data: 'assortment_data' },
  imRooms: { table: 'im_rooms', key: 'room_id', data: 'room_data' },
  imMessages: { table: 'im_messages', key: 'message_id', data: 'message_data', extra: 'room_id' },
  supportMessages: { table: 'support_messages', key: 'message_id', data: 'message_data' },
  supportConversations: { table: 'support_conversations', key: 'conversation_id', data: 'conversation_data' },
  supportConversationMessages: { table: 'support_conversation_messages', key: 'message_id', data: 'message_data', extra: 'conversation_id' },
};

const cache = Object.fromEntries(Object.keys(TABLES).map((name) => [name, new Map()]));

function config() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'curva_denim_b2b',
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    charset: 'utf8mb4',
  };
}

function parseJson(value) {
  if (value == null) return null;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function assertStore(name) {
  if (!TABLES[name]) throw new Error(`Unknown database store: ${name}`);
}

async function initializeDatabase() {
  if (ready) return;
  if (!process.env.DB_USER) throw new Error('DB_USER is required for the user-data database.');
  mysql = require('mysql2/promise');
  pool = mysql.createPool(config());
  await pool.query('SELECT 1');
  for (const [name, definition] of Object.entries(TABLES)) {
    const [rows] = await pool.query(`SELECT \`${definition.key}\` AS record_key, \`${definition.data}\` AS record_data FROM \`${definition.table}\``);
    cache[name].clear();
    rows.forEach((row) => cache[name].set(String(row.record_key), parseJson(row.record_data)));
  }
  ready = true;
  lastError = null;
}

function list(name) {
  assertStore(name);
  return Array.from(cache[name].values(), clone);
}

function get(name, key) {
  assertStore(name);
  return clone(cache[name].get(String(key)));
}

async function upsert(name, key, value, extraValue) {
  assertStore(name);
  const definition = TABLES[name];
  const recordKey = String(key);
  cache[name].set(recordKey, clone(value));
  const columns = [`\`${definition.key}\``, `\`${definition.data}\``];
  const values = [recordKey, JSON.stringify(value)];
  if (definition.extra) {
    columns.splice(1, 0, `\`${definition.extra}\``);
    values.splice(1, 0, String(extraValue || value[definition.extra === 'room_id' ? 'roomId' : 'conversationId'] || ''));
  }
  const placeholders = columns.map(() => '?').join(', ');
  await pool.query(
    `INSERT INTO \`${definition.table}\` (${columns.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE \`${definition.data}\` = VALUES(\`${definition.data}\`)`,
    values
  );
}

async function remove(name, key) {
  assertStore(name);
  const definition = TABLES[name];
  cache[name].delete(String(key));
  await pool.query(`DELETE FROM \`${definition.table}\` WHERE \`${definition.key}\` = ?`, [String(key)]);
}

async function replaceAll(name, records, keyField = 'id') {
  assertStore(name);
  const definition = TABLES[name];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`DELETE FROM \`${definition.table}\``);
    for (const record of records) {
      const key = String(record[keyField]);
      const columns = [`\`${definition.key}\``, `\`${definition.data}\``];
      const values = [key, JSON.stringify(record)];
      if (definition.extra) {
        columns.splice(1, 0, `\`${definition.extra}\``);
        values.splice(1, 0, String(record[definition.extra === 'room_id' ? 'roomId' : 'conversationId'] || ''));
      }
      await connection.query(`INSERT INTO \`${definition.table}\` (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
    }
    await connection.commit();
    cache[name] = new Map(records.map((record) => [String(record[keyField]), clone(record)]));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function recordUserEvent(input = {}) {
  if (!pool) return;
  const eventId = input.id || uuidv4();
  const ipHash = input.ip
    ? crypto.createHash('sha256').update(`${process.env.EVENT_HASH_SALT || ''}:${input.ip}`).digest('hex')
    : null;
  await pool.query(
    `INSERT INTO user_events (event_id, user_id, session_id, event_type, page_path, entity_type, entity_id, event_data, ip_hash, user_agent, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [eventId, input.userId || null, input.sessionId || null, input.eventType, input.pagePath || null,
      input.entityType || null, input.entityId || null, JSON.stringify(input.data || {}), ipHash,
      String(input.userAgent || '').slice(0, 500) || null, input.occurredAt ? new Date(input.occurredAt) : new Date()]
  );
}

function getDatabaseStatus() {
  return {
    connected: ready,
    engine: 'mysql',
    scope: 'user-data-only',
    error: lastError ? lastError.message : null,
  };
}

async function closeDatabase() {
  if (pool) await pool.end();
  pool = null;
  ready = false;
}

async function installSchema() {
  mysql = require('mysql2/promise');
  const options = config();
  const schemaPath = path.join(__dirname, 'sql', 'schema.sql');
  let sql = fs.readFileSync(schemaPath, 'utf8');
  const connection = await mysql.createConnection({ ...options, database: undefined, multipleStatements: true });
  try {
    try {
      await connection.query(sql);
    } catch (error) {
      if (!['ER_DBACCESS_DENIED_ERROR', 'ER_ACCESS_DENIED_ERROR'].includes(error.code)) throw error;
      sql = sql.replace(/CREATE DATABASE[\s\S]*?;/i, '').replace(/USE `[^`]+`;/i, `USE \`${options.database}\`;`);
      await connection.query(sql);
    }
  } finally {
    await connection.end();
  }
}

module.exports = { initializeDatabase, installSchema, list, get, upsert, remove, replaceAll, recordUserEvent, getDatabaseStatus, closeDatabase };
