const { v4: uuidv4 } = require('uuid');
const db = require('../database');

function readStore() {
  return {
    conversations: db.list('supportConversations'),
    messages: db.list('supportConversationMessages'),
  };
}

function persist(store) {
  const writes = [
    ...store.conversations.map((item) => db.upsert('supportConversations', item.id, item)),
    ...store.messages.map((item) => db.upsert('supportConversationMessages', item.id, item, item.conversationId)),
  ];
  void Promise.all(writes).catch((error) => console.error('Support persistence failed:', error.message));
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
    senderId: input.senderId, senderName: input.senderName,
    content: String(input.content || '').trim(), internalNote: Boolean(input.internalNote),
    createdAt: now, readAt: null,
  };
  store.messages.push(message);
  conversation.lastMessage = message.content.slice(0, 120);
  conversation.lastMessageAt = now;
  conversation.updatedAt = now;
  return message;
}

function createConversation(customer) {
  const store = readStore();
  let conversation = store.conversations
    .filter((item) => item.customerId === customer.id && item.status !== 'closed')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  if (conversation) return { conversation: { ...conversation }, messages: listMessages(store, conversation.id) };

  const now = new Date().toISOString();
  conversation = {
    id: uuidv4(), customerId: customer.id, customerName: customer.name || customer.username,
    customerUsername: customer.username, status: 'bot_active', assignedTo: null,
    assignedName: null, claimedBy: null, priority: 'normal', botEnabled: true,
    lastMessage: '', lastMessageAt: now, createdAt: now, updatedAt: now, resolvedAt: null,
  };
  store.conversations.push(conversation);
  appendMessageToStore(store, conversation, {
    senderType: 'bot', senderId: 'bot', senderName: 'Miss Lin · AI Assistant',
    content: 'Welcome to Curva Fabric. Tell us your end use, target composition, weight, stretch, shade, order meters and delivery needs. Ask about MOQ, swatches, pricing, testing or custom development, and request a sales representative at any time.',
  });
  persist(store);
  return { conversation: { ...conversation }, messages: listMessages(store, conversation.id) };
}

function updateConversation(conversationId, updater) {
  const store = readStore();
  const conversation = store.conversations.find((item) => item.id === conversationId);
  if (!conversation) throw new Error('Conversation not found');
  const result = updater({ store, conversation, appendMessage: (message) => appendMessageToStore(store, conversation, message) });
  conversation.updatedAt = new Date().toISOString();
  persist(store);
  return { conversation: { ...conversation }, result };
}

function getConversation(conversationId) {
  const store = readStore();
  const conversation = store.conversations.find((item) => item.id === conversationId);
  if (!conversation) throw new Error('Conversation not found');
  return { conversation: { ...conversation }, messages: listMessages(store, conversationId) };
}

function getCustomerConversation(customer) { return createConversation(customer); }
function listConversations() {
  return readStore().conversations.map((item) => ({ ...item })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

module.exports = { getCustomerConversation, getConversation, listConversations, updateConversation };
