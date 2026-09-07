const db = require('../database');

function normalizeUserName(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeVisitorId(value) {
  const visitorId = String(value || '').trim();
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(visitorId)) throw new Error('A valid visitorId is required');
  return visitorId;
}

function assertVisitorAvailable(userName, visitorId) {
  const normalizedUserName = normalizeUserName(userName);
  const normalizedVisitorId = normalizeVisitorId(visitorId);
  const current = db.get('users', normalizedVisitorId);
  if (current && normalizeUserName(current.userName) !== normalizedUserName) {
    const error = new Error('This visitor is already linked to another user_name');
    error.code = 'VISITOR_ALREADY_LINKED';
    throw error;
  }
}

function accountRows(userName) {
  const normalizedName = normalizeUserName(userName);
  return db.list('users').filter((user) => normalizeUserName(user.userName) === normalizedName);
}

function findAccount(userName) {
  return accountRows(userName).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;
}

function listAccounts() {
  const accounts = new Map();
  db.list('users').forEach((user) => {
    const userName = normalizeUserName(user.userName);
    if (!userName) return;
    const current = accounts.get(userName);
    if (!current || new Date(user.updatedAt || 0) >= new Date(current.updatedAt || 0)) accounts.set(userName, user);
  });
  return [...accounts.values()].map((account) => ({
    ...account,
    visitorIds: accountRows(account.userName).map((row) => row.visitorId),
  }));
}

async function bindVisitor(account, visitorId, updates = {}) {
  const normalizedVisitorId = normalizeVisitorId(visitorId);
  assertVisitorAvailable(account.userName, normalizedVisitorId);
  const now = new Date().toISOString();
  const record = {
    ...account,
    ...updates,
    visitorId: normalizedVisitorId,
    userName: normalizeUserName(account.userName),
    updatedAt: now,
  };
  delete record.id;
  delete record.username;
  delete record.visitorIds;
  await db.upsert('users', normalizedVisitorId, record);
  return record;
}

async function updateAccountRole(userName, role) {
  const rows = accountRows(userName);
  if (!rows.length) throw new Error('Account not found');
  const updated = [];
  for (const row of rows) updated.push(await bindVisitor(row, row.visitorId, { role }));
  return updated[0];
}

function safeAccount(account) {
  if (!account) return null;
  const { password, ...safe } = account;
  return safe;
}

module.exports = {
  accountRows,
  assertVisitorAvailable,
  bindVisitor,
  findAccount,
  listAccounts,
  normalizeUserName,
  normalizeVisitorId,
  safeAccount,
  updateAccountRole,
};
