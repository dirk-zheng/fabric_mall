require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../database');

(async () => {
  try {
    await db.initializeDatabase();
    const result = await db.runRetentionCleanup();
    console.log(JSON.stringify({ ok: true, deleted: result }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.closeDatabase();
  }
})();
