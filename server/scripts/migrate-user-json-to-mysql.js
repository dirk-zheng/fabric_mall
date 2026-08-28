require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../database');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function migrate() {
  await db.initializeDatabase();
  const dataDir = path.join(__dirname, '..', 'data');
  const users = readJson(path.join(dataDir, 'users.json'), { users: [] }).users || [];
  const quotes = readJson(path.join(dataDir, 'quotes.json'), []);
  const support = readJson(path.join(dataDir, 'support-conversations.json'), { conversations: [], messages: [] });
  for (const user of users) await db.upsert('users', user.id, user);
  for (const quote of quotes) await db.upsert('quotes', quote.id, quote);
  for (const conversation of support.conversations || []) await db.upsert('supportConversations', conversation.id, conversation);
  for (const message of support.messages || []) await db.upsert('supportConversationMessages', message.id, message, message.conversationId);
  console.log(`Migrated ${users.length} users, ${quotes.length} quotes, ${(support.conversations || []).length} support conversations and ${(support.messages || []).length} support messages.`);
  console.log('Products, FAQs and articles were intentionally not migrated.');
  await db.closeDatabase();
}

migrate().catch((error) => { console.error(`Migration failed: ${error.message}`); process.exitCode = 1; });
