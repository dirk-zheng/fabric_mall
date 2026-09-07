const { v4: uuidv4 } = require('uuid');
const db = require('../database');

function readStore() {
  return {
    conversations: db.list('supportConversations').map((item) => {
      const normalized = {
        ...item,
        customerAccount: item.customerAccount || `visitor:${item.customerId}`,
        customerVisitorId: item.customerVisitorId || item.customerId || null,
      };
      delete normalized.customerId;
      return normalized;
    }),
    messages: db.list('supportConversationMessages').map((item) => {
      const normalized = { ...item, senderAccount: item.senderAccount || item.senderId };
      delete normalized.senderId;
      return normalized;
    }),
  };
}

async function persist(store) {
  const writes = [
    ...store.conversations.map((item) => ({ name: 'supportConversations', key: item.id, value: item })),
    ...store.messages.map((item) => ({ name: 'supportConversationMessages', key: item.id, value: item, extraValue: item.conversationId })),
  ];
  await db.batchUpsert(writes);
}

function listMessages(store, conversationId) {
  return store.messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-200);
}

function appendMessageToStore(store, conversation, input) {
  const now = new Date().toISOString();
  const message = {
    id: uuidv4(), conversationId: conversation.id, senderType: input.senderType,
    senderAccount: input.senderAccount, senderName: input.senderName,
    content: String(input.content || '').trim(), internalNote: Boolean(input.internalNote),
    createdAt: now, readAt: null,
  };
  store.messages.push(message);
  conversation.lastMessage = message.content.slice(0, 120);
  conversation.lastMessageAt = now;
  conversation.updatedAt = now;
  return message;
}

async function createConversation(customer) {
  const store = readStore();
  let conversation = store.conversations
    .filter((item) => item.customerAccount === customer.account && item.status !== 'closed')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  if (conversation) return { conversation: { ...conversation }, messages: listMessages(store, conversation.id) };

  const now = new Date().toISOString();
  conversation = {
    id: uuidv4(), customerAccount: customer.account, customerVisitorId: customer.visitorId,
    customerName: customer.name || customer.account,
    status: 'bot_active', assignedTo: null,
    assignedName: null, claimedBy: null, priority: 'normal', botEnabled: true,
    lastMessage: '', lastMessageAt: now, createdAt: now, updatedAt: now, resolvedAt: null,
  };
  store.conversations.push(conversation);
  appendMessageToStore(store, conversation, {
    senderType: 'bot', senderAccount: 'bot', senderName: 'Kora · AI Assistant',
    content: 'Hello, we’re working hard to find a human support agent for you…',
  });
  await persist(store);
  return { conversation: { ...conversation }, messages: listMessages(store, conversation.id) };
}

async function updateConversation(conversationId, updater) {
  const store = readStore();
  const conversation = store.conversations.find((item) => item.id === conversationId);
  if (!conversation) throw new Error('Conversation not found');
  const result = updater({ store, conversation, appendMessage: (message) => appendMessageToStore(store, conversation, message) });
  conversation.updatedAt = new Date().toISOString();
  await persist(store);
  return { conversation: { ...conversation }, result };
}

function getConversation(conversationId) {
  const store = readStore();
  const conversation = store.conversations.find((item) => item.id === conversationId);
  if (!conversation) throw new Error('Conversation not found');
  return { conversation: { ...conversation }, messages: listMessages(store, conversationId) };
}

async function getCustomerConversation(customer) { return createConversation(customer); }

async function linkVisitorToUser(visitorId, customer) {
  const store = readStore();
  const guestAccount = `visitor:${visitorId}`;
  let changed = false;
  store.conversations.forEach((conversation) => {
    if (conversation.customerVisitorId !== visitorId || conversation.customerAccount === customer.account) return;
    conversation.customerAccount = customer.account;
    conversation.customerName = customer.name || customer.account;
    conversation.updatedAt = new Date().toISOString();
    changed = true;
  });
  store.messages.forEach((message) => {
    if (message.senderAccount !== guestAccount || message.senderType !== 'customer') return;
    message.senderAccount = customer.account;
    message.senderName = customer.name || customer.account;
    changed = true;
  });
  if (changed) await persist(store);
}

function listConversations() {
  return readStore().conversations.map((item) => ({ ...item })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

module.exports = { getCustomerConversation, getConversation, linkVisitorToUser, listConversations, updateConversation };
