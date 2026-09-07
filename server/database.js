const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

let mysql;
let pool;
let ready = false;
let lastError = null;

const TABLES = {
  users: { table: 'users', key: 'visitor_id', data: 'user_data' },
  quotes: { table: 'quotes', key: 'quote_id', data: 'quote_data' },
  rfqAssortments: { table: 'rfq_assortments', key: 'visitor_id', data: 'assortment_data' },
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
    database: process.env.DB_NAME || 'curva_fabric_b2b',
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

function assertRecordContract(name, recordKey, value, extraValue) {
  if (!recordKey || recordKey.length > 64) throw new Error(`${name} key must be 1 to 64 characters.`);
  const identityFields = {
    users: 'visitorId', rfqAssortments: 'visitorId', quotes: 'id', imRooms: 'roomId',
    imMessages: 'id', supportConversations: 'id', supportConversationMessages: 'id',
  };
  const identityField = identityFields[name];
  if (identityField && value?.[identityField] != null && String(value[identityField]) !== recordKey) {
    throw new Error(`${name}.${identityField} must match its database key.`);
  }
  if (name === 'users') {
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(recordKey)) throw new Error('A valid visitorId is required.');
    const userName = String(value?.userName || '').trim();
    if (!userName || userName.length > 255) throw new Error('user_name must be 1 to 255 characters.');
  }
  if (name === 'rfqAssortments' && !/^[a-zA-Z0-9-]{16,64}$/.test(recordKey)) throw new Error('A valid visitorId is required.');
  if (TABLES[name].extra) {
    const extra = String(extraValue || value?.[TABLES[name].extra === 'room_id' ? 'roomId' : 'conversationId'] || '');
    if (!extra || extra.length > 64) throw new Error(`${TABLES[name].extra} must be 1 to 64 characters.`);
  }
}

async function initializeDatabase() {
  if (ready) return;
  if (!process.env.DB_USER) throw new Error('DB_USER is required for the user-data database.');
  mysql = require('mysql2/promise');
  pool = mysql.createPool(config());
  try {
    await pool.query('SELECT 1');
    const loaded = {};
    for (const [name, definition] of Object.entries(TABLES)) {
      const [rows] = await pool.query(`SELECT \`${definition.key}\` AS record_key, \`${definition.data}\` AS record_data FROM \`${definition.table}\``);
      loaded[name] = new Map(rows.map((row) => [String(row.record_key), parseJson(row.record_data)]));
    }
    Object.entries(loaded).forEach(([name, records]) => { cache[name] = records; });
    ready = true;
    lastError = null;
  } catch (error) {
    lastError = error;
    await pool.end().catch(() => {});
    pool = null;
    throw error;
  }
}

function list(name) {
  assertStore(name);
  return Array.from(cache[name].values(), clone);
}

function get(name, key) {
  assertStore(name);
  return clone(cache[name].get(String(key)));
}

function buildUpsert(name, key, value, extraValue) {
  assertStore(name);
  const definition = TABLES[name];
  const recordKey = String(key);
  assertRecordContract(name, recordKey, value, extraValue);
  const columns = [`\`${definition.key}\``, `\`${definition.data}\``];
  const values = [recordKey, JSON.stringify(value)];
  if (definition.extra) {
    columns.splice(1, 0, `\`${definition.extra}\``);
    values.splice(1, 0, String(extraValue || value[definition.extra === 'room_id' ? 'roomId' : 'conversationId'] || ''));
  }
  const placeholders = columns.map(() => '?').join(', ');
  const updateColumns = [`\`${definition.data}\` = VALUES(\`${definition.data}\`)`];
  if (definition.extra) updateColumns.push(`\`${definition.extra}\` = VALUES(\`${definition.extra}\`)`);
  return {
    name,
    recordKey,
    value,
    sql: `INSERT INTO \`${definition.table}\` (${columns.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateColumns.join(', ')}`,
    values,
  };
}

async function upsert(name, key, value, extraValue) {
  const operation = buildUpsert(name, key, value, extraValue);
  await pool.query(operation.sql, operation.values);
  cache[name].set(operation.recordKey, clone(value));
}

async function batchUpsert(operations) {
  const prepared = operations.map((operation) => buildUpsert(operation.name, operation.key, operation.value, operation.extraValue));
  if (!prepared.length) return;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const operation of prepared) await connection.query(operation.sql, operation.values);
    await connection.commit();
    prepared.forEach((operation) => cache[operation.name].set(operation.recordKey, clone(operation.value)));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function remove(name, key) {
  assertStore(name);
  const definition = TABLES[name];
  const recordKey = String(key);
  await pool.query(`DELETE FROM \`${definition.table}\` WHERE \`${definition.key}\` = ?`, [recordKey]);
  cache[name].delete(recordKey);
}

async function refresh(name) {
  assertStore(name);
  const definition = TABLES[name];
  const [rows] = await pool.query(`SELECT \`${definition.key}\` AS record_key, \`${definition.data}\` AS record_data FROM \`${definition.table}\``);
  cache[name] = new Map(rows.map((row) => [String(row.record_key), parseJson(row.record_data)]));
  return list(name);
}

async function refreshUsersByName(userName) {
  const normalizedName = String(userName || '').trim().toLowerCase();
  const [rows] = await pool.query('SELECT visitor_id AS record_key, user_data AS record_data FROM users WHERE user_name = ?', [normalizedName]);
  for (const [key, user] of cache.users.entries()) {
    if (String(user.userName || '').trim().toLowerCase() === normalizedName) cache.users.delete(key);
  }
  rows.forEach((row) => cache.users.set(String(row.record_key), parseJson(row.record_data)));
  return rows.map((row) => clone(parseJson(row.record_data)));
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
  const visitorId = String(input.visitorId || '').trim();
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(visitorId)) throw new Error('A valid visitorId is required when recording a user event.');
  const eventId = String(input.id || uuidv4()).trim();
  const eventType = String(input.eventType || '').trim();
  if (!eventId || eventId.length > 64) throw new Error('eventId must be 1 to 64 characters.');
  if (!eventType || eventType.length > 100) throw new Error('eventType must be 1 to 100 characters.');
  const pagePath = input.pagePath == null ? null : String(input.pagePath);
  const entityType = input.entityType == null ? null : String(input.entityType);
  const entityId = input.entityId == null ? null : String(input.entityId);
  if (pagePath?.length > 500) throw new Error('pagePath must be 500 characters or fewer.');
  if (entityType?.length > 64) throw new Error('entityType must be 64 characters or fewer.');
  if (entityId?.length > 128) throw new Error('entityId must be 128 characters or fewer.');
  const ipHash = input.ip
    ? crypto.createHash('sha256').update(`${process.env.EVENT_HASH_SALT || ''}:${input.ip}`).digest('hex')
    : null;
  await pool.query(
    `INSERT INTO user_events (visitor_id, event_id, event_type, page_path, entity_type, entity_id, event_data, ip_hash, user_agent, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [visitorId, eventId, eventType, pagePath,
      entityType, entityId, JSON.stringify(input.data || {}), ipHash,
      String(input.userAgent || '').slice(0, 500) || null, input.occurredAt ? new Date(input.occurredAt) : new Date()]
  );
}

async function listUserBehavior(userName) {
  const normalizedName = String(userName || '').trim().toLowerCase();
  if (!normalizedName || !pool) return { visitorIds: [], events: [] };
  const [userRows] = await pool.query('SELECT visitor_id AS visitorId FROM users WHERE user_name = ?', [normalizedName]);
  const visitorIds = userRows.map((row) => row.visitorId);
  if (!visitorIds.length || !pool) return { visitorIds, events: [] };
  const placeholders = visitorIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT visitor_id AS visitorId, event_id AS eventId, event_type AS eventType,
            page_path AS pagePath, entity_type AS entityType, entity_id AS entityId,
            event_data AS eventData, occurred_at AS occurredAt
      FROM user_events
      WHERE visitor_id IN (${placeholders})
      ORDER BY occurred_at ASC`,
    visitorIds
  );
  return { visitorIds, events: rows.map((row) => ({ ...row, eventData: parseJson(row.eventData) })) };
}

function getDatabaseStatus() {
  return {
    connected: ready,
    engine: 'mysql',
    database: config().database,
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

module.exports = { initializeDatabase, installSchema, list, get, upsert, batchUpsert, remove, replaceAll, refresh, refreshUsersByName, recordUserEvent, listUserBehavior, getDatabaseStatus, closeDatabase };
