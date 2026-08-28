require('dotenv').config();
const { installSchema } = require('../database');

installSchema()
  .then(() => console.log('User-data schema installed successfully.'))
  .catch((error) => { console.error(`Schema installation failed: ${error.message}`); process.exitCode = 1; });
