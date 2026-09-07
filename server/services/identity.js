const db = require('../database');

function normalizeAccount(value) {
  const account = String(value || '').trim().toLowerCase();
  if (account.length > 255) {
    const error = new Error('account must be 255 characters or fewer');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return account;
}

function normalizeVisitorId(value) {
  const visitorId = String(value || '').trim();
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(visitorId)) {
    const error = new Error('A valid visitorId is required');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return visitorId;
}

function assertVisitorAvailable(account, visitorId) {
  const normalizedAccount = normalizeAccount(account);
  const normalizedVisitorId = normalizeVisitorId(visitorId);
  const current = db.get('users', normalizedVisitorId);
  if (current && normalizeAccount(current.account) !== normalizedAccount) {
    const error = new Error('This visitor is already linked to another account');
    error.code = 'VISITOR_ALREADY_LINKED';
    throw error;
  }
}

function accountRows(account) {
  const normalizedAccount = normalizeAccount(account);
  return db.list('users').filter((user) => normalizeAccount(user.account) === normalizedAccount);
}

function findAccount(account) {
  return accountRows(account).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;
}

function listAccounts() {
  const accounts = new Map();
  db.list('users').forEach((user) => {
    const account = normalizeAccount(user.account);
    if (!account) return;
    const current = accounts.get(account);
    if (!current || new Date(user.updatedAt || 0) >= new Date(current.updatedAt || 0)) accounts.set(account, user);
  });
  return [...accounts.values()].map((account) => ({
    ...account,
    visitorIds: accountRows(account.account).map((row) => row.visitorId),
  }));
}

async function bindVisitor(account, visitorId, updates = {}) {
  const normalizedVisitorId = normalizeVisitorId(visitorId);
  assertVisitorAvailable(account.account, normalizedVisitorId);
  const now = new Date().toISOString();
  const record = {
    ...account,
    ...updates,
    visitorId: normalizedVisitorId,
    account: normalizeAccount(account.account),
    updatedAt: now,
  };
  delete record.id;
  delete record.visitorIds;
  await db.upsert('users', normalizedVisitorId, record);
  return record;
}

async function updateAccountRole(account, role) {
  const rows = accountRows(account);
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
  normalizeAccount,
  normalizeVisitorId,
  safeAccount,
  updateAccountRole,
};
