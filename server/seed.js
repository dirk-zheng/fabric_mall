require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('./database');
const ADMIN_ACCOUNT = require('./config/admin');
const { bindVisitor, findAccount } = require('./services/identity');

// 确保工程内固定管理员及固定密码始终生效。
async function ensureAdminAccount() {
  await db.initializeDatabase();
  const existingAdmin = findAccount(ADMIN_ACCOUNT.userName);

  if (existingAdmin) {
    if (existingAdmin.role !== 'admin') throw new Error(`Fixed administrator user_name "${ADMIN_ACCOUNT.userName}" is already used by a non-admin account.`);
    const passwordMatches = await bcrypt.compare(ADMIN_ACCOUNT.password, existingAdmin.password);
    const needsUpdate = !passwordMatches || existingAdmin.name !== ADMIN_ACCOUNT.name;
    if (!needsUpdate) return { created: false, updated: false, user: existingAdmin };
    const updatedAdmin = {
      ...existingAdmin,
      name: ADMIN_ACCOUNT.name,
      password: passwordMatches ? existingAdmin.password : await bcrypt.hash(ADMIN_ACCOUNT.password, 12),
      updatedAt: new Date().toISOString(),
    };
    await bindVisitor(updatedAdmin, existingAdmin.visitorId);
    return { created: false, updated: true, user: updatedAdmin };
  }

  const user = {
    visitorId: ADMIN_ACCOUNT.visitorId,
    userName: ADMIN_ACCOUNT.userName,
    password: await bcrypt.hash(ADMIN_ACCOUNT.password, 12),
    role: ADMIN_ACCOUNT.role,
    name: ADMIN_ACCOUNT.name,
    createdAt: new Date().toISOString(),
  };

  await db.upsert('users', user.visitorId, user);
  return { created: true, user };
}

if (require.main === module) {
  ensureAdminAccount()
    .then(async ({ created, user }) => {
      console.log(created ? `Fixed administrator created: ${user.userName}` : `Fixed administrator verified: ${user.userName}`);
      await db.closeDatabase();
    })
    .catch((error) => {
      console.error(`Seed failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { ensureAdminAccount, ADMIN_ACCOUNT };
