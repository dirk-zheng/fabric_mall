const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { JWT_SECRET, generateToken } = require('./middleware/auth');
const { notifyRobotChat, notifyQuoteInquiry } = require('./services/emailNotifications');
const supportConversations = require('./services/supportConversations');
const db = require('./database');

// ─── Data Paths ──────────────────────────────────
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');
const ARTICLES_FILE = path.join(__dirname, 'data', 'articles.json');
const FAQS_FILE = path.join(__dirname, 'data', 'faqs.json');

// ─── File Helpers ────────────────────────────────
//读取商品数据列表
function readProducts() {
  return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
}

//将商品数据列表写入本地文件
function writeProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
}

//读取用户数据列表
function readUsers() {
  return db.list('users').map((user) => (
    user.role === 'salesperson' ? { ...user, role: 'seller' } : user
  ));
}

//将用户数据列表写入本地文件
function writeUsers(users) {
  return Promise.all(users.map((user) => db.upsert('users', user.id, user)));
}

//读取询价数据列表
function readQuotes() {
  return db.list('quotes');
}

//将询价数据列表写入本地文件
function writeQuotes(quotes) {
  return Promise.all(quotes.map((quote) => db.upsert('quotes', quote.id, quote)));
}

//从指定文件读取数组类型的内容数据
function readList(file) {
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return Array.isArray(data) ? data : [];
}

//将内容数组写入指定本地文件
function writeList(file, list) {
  fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf-8');
}

// ─── In-Memory RFQ Assortment Builder ────────────
const rfqAssortmentStore = {};

//获取指定用户的 RFQ 选品清单并在不存在时初始化
function getUserRfqAssortment(userId) {
  if (!rfqAssortmentStore[userId]) rfqAssortmentStore[userId] = db.get('rfqAssortments', userId)?.items || [];
  return rfqAssortmentStore[userId];
}

function saveUserRfqAssortment(userId) {
  return db.upsert('rfqAssortments', userId, { userId, items: getUserRfqAssortment(userId), updatedAt: new Date().toISOString() });
}

// ─── In-Memory IM Store ──────────────────────────
const imRooms = {};      // roomId → { roomId, members[], memberNames{}, lastMessage, updatedAt }
const imMessages = {};   // roomId → [ { id, roomId, senderId, senderName, content, timestamp } ]
const clientMap = new Map(); // userId → Set<WebSocket>

//获取或创建两个用户之间的即时通信房间
function getOrCreateRoom(userA, userB) {
  const ids = [userA.id, userB.id].sort();
  const roomId = `chat_${ids[0]}_${ids[1]}`;
  if (!imRooms[roomId]) {
    imRooms[roomId] = {
      roomId,
      members: ids,
      memberNames: { [userA.id]: userA.name || userA.username, [userB.id]: userB.name || userB.username },
      lastMessage: '',
      updatedAt: new Date().toISOString()
    };
  }
  if (!imMessages[roomId]) {
    imMessages[roomId] = [];
  }
  return imRooms[roomId];
}

//登记指定用户的WebSocket客户端连接
function addClient(userId, ws) {
  if (!clientMap.has(userId)) clientMap.set(userId, new Set());
  clientMap.get(userId).add(ws);
}

//移除指定用户的WebSocket客户端连接
function removeClient(userId, ws) {
  const set = clientMap.get(userId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) clientMap.delete(userId);
  }
}

//向指定用户的全部在线连接推送消息
function sendToUser(userId, data) {
  const set = clientMap.get(userId);
  if (set) {
    const payload = JSON.stringify(data);
    //向用户的每个有效WebSocket连接发送数据
    set.forEach(ws => {
      if (ws.readyState === 1) ws.send(payload);
    });
  }
}

//组合用户 RFQ 选品清单与对应商品详情
function buildRfqAssortmentItems(userId) {
  const assortment = getUserRfqAssortment(userId);
  const products = readProducts();
  const items = assortment
    //将选品商品ID映射为完整商品信息
    .map(item => {
      //根据选品商品ID查找商品数据
      const product = products.find(p => p.id === item.productId);
      if (!product) return null;
      return { product, quantity: item.quantity };
    })
    .filter(Boolean);
  //累计 RFQ 选品清单中的商品总数量
  return { items, totalCount: items.reduce((s, i) => s + i.quantity, 0) };
}

// ─── Support (AI) ────────────────────────────────
const keywordRules = [
  {
    keywords: ['weight', 'gsm', 'ounce', 'composition', 'width', 'stretch', 'shrinkage', 'skew'],
    response: 'Fabric Technical Support 🧵\n\nShare your end use, target composition, weight, width and stretch. Final test methods, values and tolerances are confirmed on the approved quality sheet.'
  },
  {
    keywords: ['moq', 'minimum order', 'sample', 'quantity', 'private label', 'assortment', 'opening order', 'trial order'],
    response: 'Flexible Fabric Planning 📦\n\nCore qualities typically start from 1,000–1,500 meters per color. MOQ, swatch availability and timing are confirmed by quality.'
  },
  {
    keywords: ['document', 'report', 'customs', 'clearance', 'fabric test', 'care label', 'compliance'],
    response: 'Fabric & Order Documents 📄\n\nComposition, weight, width, physical tests, roll packing and available documents are confirmed against the selected quality and destination requirements.'
  },
  {
    keywords: ['price', 'cost', 'how much', 'cheap', 'discount', 'promotion', 'pricing', 'quote'],
    response: 'Practical Fabric Quotation 💰\n\nPricing depends on composition, construction, dye, finish, testing, meters and terms. Send the weight, stretch, shade and volume you need.'
  },
  {
    keywords: ['shipping', 'delivery', 'logistics', 'transport', 'how long', 'freight', 'tracking'],
    response: 'Order & Export Support 🚢\n\nRoll packing, marks, packing lists, commercial invoices and export coordination follow the confirmed order and Incoterms. Destination requirements are agreed before shipment.'
  },
  {
    keywords: ['return', 'refund', 'warranty', 'quality', 'damage', 'defect', 'exchange', 'inspect', 'inspection', 'qc', 'measurement', 'shade', 'stitching', 'hardware'],
    response: 'Denim Fabric Quality 🛡️\n\nInspection can cover four-point defects, shade, width, weight, shrinkage, skew, strength, stretch and packing. Sampling, acceptance criteria and remedies are agreed in the order terms.'
  },
  {
    keywords: ['payment', 'pay', 'method', 'wire', 'bank', 'credit', 'terms', 'TT', 'LC'],
    response: 'Order Terms 💳\n\nPayment terms are confirmed clearly in the quotation and proforma invoice for each order. Our team keeps the order, QC, loading and document requirements aligned so there are no surprises before shipment.'
  }
];

const defaultReplies = [
  'Thank you for contacting Curva Fabric. Ask about MOQ, swatches, pricing, technical data, custom development or delivery.',
  'Hello! Share your end use, composition, weight, stretch, estimated meters and delivery needs.',
  'Welcome to Curva Fabric. We support apparel brands, garment factories and fabric buyers worldwide.'
];

//根据用户消息关键词生成客服回复
function getAIResponse(userMessage) {
  const lower = userMessage.toLowerCase();
  for (const rule of keywordRules) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return { reply: rule.response, matchedKeyword: kw };
      }
    }
  }
  const random = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
  return { reply: random, matchedKeyword: null };
}

// ─── Validation ──────────────────────────────────
//校验商品新增或更新数据
function validateProduct(body) {
  const errors = [];
  if (!body.name || body.name.length < 2 || body.name.length > 100)
    errors.push('Product name must be 2-100 characters');
  if (!body.category || !['jeans', 'denim-skirts', 'denim-jackets'].includes(body.category))
    errors.push('Please select a valid product category');
  if (!body.image)
    errors.push('Please provide a product image URL');
  if (!body.description)
    errors.push('Please provide a product description');
  return errors;
}

//校验WebSocket用户是否拥有管理员权限
function checkAdmin(ws) {
  if (!ws.user || ws.user.role !== 'admin') {
    throw new Error('Access denied. Admin only.');
  }
}

//校验WebSocket连接是否已经完成身份认证
function checkAuth(ws) {
  if (!ws.user) {
    throw new Error('Not authenticated. Please sign in.');
  }
}

// ─── Handlers ────────────────────────────────────

// Auth
//处理WebSocket用户登录并更新连接身份
async function handleLogin(payload, ws) {
  const { username, password } = payload || {};
  if (!username || !password) throw new Error('Username and password are required');

  const users = readUsers();
  //根据用户名查找登录用户
  const loginName = String(username).trim().toLowerCase();
  const user = users.find(u => String(u.username).toLowerCase() === loginName);
  if (!user) throw new Error('Invalid username or password');

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error('Invalid username or password');

  const token = generateToken(user);
  const { password: _, ...safeUser } = user;

  // Update this connection's auth
  ws.user = { id: user.id, username: user.username, role: user.role, name: user.name };
  ws.userId = user.id;
  addClient(user.id, ws);
  await db.recordUserEvent({ userId: user.id, eventType: 'auth.login_succeeded', data: { channel: 'websocket' } });

  return { user: safeUser, token };
}

//处理WebSocket用户注册并更新连接身份
async function handleRegister(payload, ws) {
  const { username, password, name, quoteReference } = payload || {};
  if (!username || !password) throw new Error('Username and password are required');
  if (typeof password !== 'string' || password.length < 6) throw new Error('Password must be at least 6 characters');

  const users = readUsers();
  const normalizedUsername = String(username).trim();
  const accountUsername = normalizedUsername.includes('@') ? normalizedUsername.toLowerCase() : normalizedUsername;
  //检查注册用户名是否已经存在
  if (users.some(u => String(u.username).toLowerCase() === accountUsername.toLowerCase())) throw new Error('An account already uses this email or username');

  const hashed = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    username: accountUsername,
    password: hashed,
    role: 'user',
    name: name || accountUsername
  };
  users.push(newUser);
  await writeUsers(users);

  if (quoteReference && accountUsername.includes('@')) {
    const quotes = readQuotes();
    const quote = quotes.find((item) => item.reference === quoteReference && item.customer?.email?.toLowerCase() === accountUsername);
    if (quote) {
      quote.userId = newUser.id;
      quote.accountLinkedAt = new Date().toISOString();
      await writeQuotes(quotes);
    }
  }

  const token = generateToken(newUser);
  const { password: _, ...safeUser } = newUser;

  ws.user = { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name };
  ws.userId = newUser.id;
  addClient(newUser.id, ws);
  await db.recordUserEvent({ userId: newUser.id, eventType: 'auth.registered', data: { channel: 'websocket' } });

  return { user: safeUser, token };
}

//返回当前WebSocket连接的用户信息
function handleMe(payload, ws) {
  checkAuth(ws);
  return ws.user;
}

// Products
//查询商品列表并执行搜索筛选排序和分页
function handleProductList(payload) {
  let products = readProducts();
  const { search, category, sort, page = 1, pageSize = 20 } = payload || {};

  if (search) {
    const q = search.toLowerCase();
    //根据商品名称和描述筛选搜索结果
    products = products.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  if (category && category !== 'all') {
    //根据商品分类筛选商品列表
    products = products.filter(p => p.category === category);
  }
  //根据价格按升序排列商品列表
  if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
  //根据价格按降序排列商品列表
  else if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);

  const total = products.length;
  const p = parseInt(page), ps = parseInt(pageSize);
  const start = (p - 1) * ps;
  const paged = products.slice(start, start + ps);

  return { list: paged, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) };
}

//统计并返回商品分类数量
function handleProductCategories() {
  const products = readProducts();
  const map = {};
  //遍历商品并累计每个分类数量
  products.forEach(p => { map[p.category] = (map[p.category] || 0) + 1; });
  //将分类统计对象转换为数组格式
  const categories = Object.entries(map).map(([name, count]) => ({ name, count }));
  return { total: products.length, categories };
}

//根据商品ID返回单个商品详情
function handleProductGet(payload) {
  const products = readProducts();
  //根据商品ID查找商品详情
  const product = products.find(p => p.id === payload.id);
  if (!product) throw new Error('Product not found');
  return product;
}

//校验管理员权限并新增商品
function handleProductCreate(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);

  const errors = validateProduct(payload);
  if (errors.length > 0) throw new Error(errors.join('; '));

  const products = readProducts();
  const newProduct = {
    id: uuidv4(),
    name: payload.name.trim(),
    category: payload.category,
    price: 0,
    stock: 0,
    image: payload.image.trim(),
    description: payload.description.trim(),
    moq: String(payload.moq || '').trim(),
    leadTime: String(payload.leadTime || '').trim(),
    applications: String(payload.applications || '').trim(),
    specs: Array.isArray(payload.specs) ? payload.specs.map(String).filter(Boolean) : [],
    qc: Array.isArray(payload.qc) ? payload.qc.map(String).filter(Boolean) : []
  };
  products.push(newProduct);
  writeProducts(products);
  return newProduct;
}

//校验管理员权限并更新指定商品
function handleProductUpdate(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);

  const errors = validateProduct(payload);
  if (errors.length > 0) throw new Error(errors.join('; '));

  const products = readProducts();
  //查找需要更新的商品索引
  const idx = products.findIndex(p => p.id === payload.id);
  if (idx === -1) throw new Error('Product not found');

  products[idx] = {
    ...products[idx],
    name: payload.name.trim(),
    category: payload.category,
    image: payload.image.trim(),
    description: payload.description.trim(),
    moq: String(payload.moq || '').trim(),
    leadTime: String(payload.leadTime || '').trim(),
    applications: String(payload.applications || '').trim(),
    specs: Array.isArray(payload.specs) ? payload.specs.map(String).filter(Boolean) : products[idx].specs,
    qc: Array.isArray(payload.qc) ? payload.qc.map(String).filter(Boolean) : products[idx].qc
  };
  writeProducts(products);
  return products[idx];
}

//校验管理员权限并删除指定商品
function handleProductDelete(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);

  const products = readProducts();
  //查找需要删除的商品索引
  const idx = products.findIndex(p => p.id === payload.id);
  if (idx === -1) throw new Error('Product not found');

  const removed = products.splice(idx, 1)[0];
  writeProducts(products);
  return removed;
}

// RFQ assortment builder
//返回当前用户的 RFQ 选品清单详情
function handleRfqAssortmentGet(payload, ws) {
  checkAuth(ws);
  return buildRfqAssortmentItems(ws.userId);
}

//向当前用户的 RFQ 选品清单添加商品
async function handleRfqAssortmentAdd(payload, ws) {
  checkAuth(ws);
  const { productId, quantity = 1 } = payload || {};
  if (!productId) throw new Error('Product ID is required');

  const products = readProducts();
  //根据商品ID查找准备加入选品清单的商品
  const product = products.find(p => p.id === productId);
  if (!product) throw new Error('Product not found');

  const assortment = getUserRfqAssortment(ws.userId);
  //查找选品清单中是否已有相同商品
  const existing = assortment.find(i => i.productId === productId);
  if (existing) existing.quantity += quantity;
  else assortment.push({ productId, quantity });

  await saveUserRfqAssortment(ws.userId);
  await db.recordUserEvent({ userId: ws.userId, eventType: 'assortment.item_added', entityType: 'product', entityId: productId, data: { quantity } });

  return { productId, quantity: existing ? existing.quantity : quantity };
}

//更新 RFQ 选品清单中指定商品的数量
async function handleRfqAssortmentUpdate(payload, ws) {
  checkAuth(ws);
  const { productId, quantity } = payload || {};
  if (!quantity || quantity < 1 || !Number.isInteger(quantity))
    throw new Error('Quantity must be a positive integer');

  const assortment = getUserRfqAssortment(ws.userId);
  //查找需要更新数量的选品商品
  const item = assortment.find(i => i.productId === productId);
  if (!item) throw new Error('Item not found in RFQ assortment');

  item.quantity = quantity;
  await saveUserRfqAssortment(ws.userId);
  return { productId, quantity };
}

//从 RFQ 选品清单移除指定商品
async function handleRfqAssortmentRemove(payload, ws) {
  checkAuth(ws);
  const { productId } = payload || {};
  const assortment = getUserRfqAssortment(ws.userId);
  //查找需要移除的选品商品索引
  const idx = assortment.findIndex(i => i.productId === productId);
  if (idx === -1) throw new Error('Item not found in RFQ assortment');

  assortment.splice(idx, 1);
  await saveUserRfqAssortment(ws.userId);
  return { removed: productId };
}

//清空当前用户的 RFQ 选品清单
async function handleRfqAssortmentClear(payload, ws) {
  checkAuth(ws);
  rfqAssortmentStore[ws.userId] = [];
  await saveUserRfqAssortment(ws.userId);
  return { cleared: true };
}

//校验并保存登录用户提交的 RFQ 询价
async function handleQuoteSubmit(payload, ws) {
  checkAuth(ws);
  const {
    market,
    targetCustomerProfile,
    specifications,
    estimatedQuantity,
    notes = ''
  } = payload || {};

  if (!market?.trim()) throw new Error('Target market is required');
  if (!targetCustomerProfile?.trim()) throw new Error('Target customer and size range are required');
  if (!specifications?.trim()) throw new Error('Denim style and specification details are required');
  const quantity = Number(estimatedQuantity);
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Estimated quantity must be a positive integer');
  const { items } = buildRfqAssortmentItems(ws.userId);
  if (items.length === 0) throw new Error('Add at least one product program to the RFQ assortment');

  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const reference = `RFQ-${datePart}-${uuidv4().slice(0, 6).toUpperCase()}`;
  const quote = {
    id: uuidv4(),
    reference,
    status: 'new',
    customer: {
      id: ws.userId,
      username: ws.user.username,
      name: ws.user.name || ws.user.username
    },
    market: market.trim(),
    targetCustomerProfile: targetCustomerProfile.trim(),
    specifications: specifications.trim(),
    estimatedQuantity: quantity,
    notes: String(notes).trim(),
    //将 RFQ 选品转换为询价存档格式
    items: items.map(({ product, quantity: itemQuantity }) => ({
      productId: product.id,
      name: product.name,
      description: product.description,
      quantity: itemQuantity
    })),
    createdAt: now.toISOString()
  };

  const quotes = readQuotes();
  quotes.push(quote);
  await writeQuotes(quotes);
  rfqAssortmentStore[ws.userId] = [];
  await saveUserRfqAssortment(ws.userId);
  await db.recordUserEvent({ userId: ws.userId, eventType: 'quote.submitted', entityType: 'quote', entityId: quote.id, data: { reference } });
  void notifyQuoteInquiry(quote);

  return {
    reference,
    status: quote.status,
    createdAt: quote.createdAt,
    message: 'Quote request received. Our team will review the styles, size range, quantity and delivery requirements.'
  };
}

// Support
//处理客服聊天消息并返回匹配回复
function handleSupportChat(payload, ws) {
  checkAuth(ws);
  const { message } = payload || {};
  if (!message || !message.trim()) throw new Error('Message cannot be empty');

  const userMessage = message.trim();
  const result = getAIResponse(userMessage);
  const timestamp = new Date().toISOString();
  void notifyRobotChat({ user: ws.user, message: userMessage, matchedKeyword: result.matchedKeyword, timestamp });
  return {
    userMessage,
    aiReply: result.reply,
    matchedKeyword: result.matchedKeyword,
    timestamp
  };
}

function isStaff(user) {
  return Boolean(user && ['seller', 'salesperson', 'admin'].includes(user.role));
}

function checkStaff(ws) {
  if (!isStaff(ws.user)) throw new Error('Access denied. Sales staff only.');
}

function supportStaffUsers() {
  return readUsers().filter(isStaff);
}

function pushSupportEvent(conversation, type, data) {
  const recipients = new Set([conversation.customerId]);
  supportStaffUsers().forEach((staff) => {
    if (staff.role === 'admin' || staff.id === conversation.assignedTo || conversation.status === 'waiting_human') {
      recipients.add(staff.id);
    }
  });
  recipients.forEach((userId) => sendToUser(userId, { type, success: true, data }));
}

function pushSupportUpdate(conversation, messages = []) {
  pushSupportEvent(conversation, 'support.conversation.updated', conversation);
  messages.filter(Boolean).forEach((message) => pushSupportEvent(conversation, 'support.message.created', message));
}

function requireConversationCustomer(conversation, ws) {
  if (conversation.customerId !== ws.userId) throw new Error('Access denied');
}

function requireAssignedStaff(conversation, ws) {
  checkStaff(ws);
  if (ws.user.role !== 'admin' && conversation.assignedTo !== ws.userId) {
    throw new Error('Claim this conversation before replying');
  }
}

function shouldRequestHuman(message) {
  return /(human|person|sales|salesperson|representative|agent|人工|销售|业务员|管理员|whatsapp|quotation|formal quote)/i.test(message);
}

function handleSupportConversationGet(payload, ws) {
  checkAuth(ws);
  if (isStaff(ws.user)) {
    if (!payload?.conversationId) throw new Error('A conversation ID is required');
    const result = supportConversations.getConversation(payload.conversationId);
    if (ws.user.role !== 'admin' && result.conversation.status !== 'waiting_human' && result.conversation.assignedTo !== ws.userId) {
      throw new Error('Access denied');
    }
    return result;
  }
  return supportConversations.getCustomerConversation(ws.user);
}

function handleSupportMessageSend(payload, ws) {
  checkAuth(ws);
  const content = String(payload?.content || '').trim();
  if (!content) throw new Error('Message cannot be empty');
  if (content.length > 3000) throw new Error('Message must be 3000 characters or fewer');

  let conversationId = payload?.conversationId;
  if (!isStaff(ws.user)) conversationId = supportConversations.getCustomerConversation(ws.user).conversation.id;
  if (!conversationId) throw new Error('Conversation ID is required');

  const current = supportConversations.getConversation(conversationId).conversation;
  if (isStaff(ws.user)) requireAssignedStaff(current, ws);
  else requireConversationCustomer(current, ws);

  const createdMessages = [];
  const updated = supportConversations.updateConversation(conversationId, ({ conversation, appendMessage }) => {
    if (conversation.status === 'closed') throw new Error('Conversation is closed');
    if (!isStaff(ws.user) && conversation.status === 'resolved') {
      conversation.status = 'bot_active';
      conversation.botEnabled = true;
      conversation.assignedTo = null;
      conversation.assignedName = null;
      conversation.claimedBy = null;
      conversation.resolvedAt = null;
    }

    const message = appendMessage({
      senderType: isStaff(ws.user) ? (ws.user.role === 'admin' ? 'admin' : 'seller') : 'customer',
      senderId: ws.userId,
      senderName: ws.user.name || ws.user.username,
      content,
    });
    createdMessages.push(message);

    if (!isStaff(ws.user) && conversation.status === 'bot_active') {
      if (shouldRequestHuman(content)) {
        conversation.status = 'waiting_human';
        conversation.botEnabled = false;
        conversation.priority = 'high';
        createdMessages.push(appendMessage({
          senderType: 'system', senderId: 'system', senderName: 'Curva Fabric Support',
          content: 'Your request has been added to our sales queue. A team member will join this conversation shortly.',
        }));
      } else {
        const result = getAIResponse(content);
        createdMessages.push(appendMessage({
          senderType: 'bot', senderId: 'bot', senderName: 'Miss Lin · AI Assistant', content: result.reply,
        }));
        void notifyRobotChat({ user: ws.user, message: content, matchedKeyword: result.matchedKeyword, timestamp: message.createdAt });
      }
    }
  });

  pushSupportUpdate(updated.conversation, createdMessages);
  return { conversation: updated.conversation, messages: createdMessages };
}

function handleSupportHandoffRequest(payload, ws) {
  checkAuth(ws);
  if (isStaff(ws.user)) throw new Error('Only customers can request a sales representative');
  const current = supportConversations.getCustomerConversation(ws.user).conversation;
  const createdMessages = [];
  const updated = supportConversations.updateConversation(current.id, ({ conversation, appendMessage }) => {
    if (conversation.status === 'human_active' || conversation.status === 'waiting_human') return;
    conversation.status = 'waiting_human';
    conversation.botEnabled = false;
    conversation.priority = 'high';
    conversation.assignedTo = null;
    conversation.assignedName = null;
    conversation.claimedBy = null;
    conversation.resolvedAt = null;
    createdMessages.push(appendMessage({
      senderType: 'system', senderId: 'system', senderName: 'Curva Fabric Support',
      content: 'A sales representative has been requested. Please keep this window open; your conversation history will be shared with the team.',
    }));
  });
  pushSupportUpdate(updated.conversation, createdMessages);
  return { conversation: updated.conversation, messages: createdMessages };
}

function handleSupportQueueList(payload, ws) {
  checkAuth(ws);
  checkStaff(ws);
  const all = supportConversations.listConversations();
  if (ws.user.role === 'admin') return all.filter((item) => item.status !== 'closed');
  return all.filter((item) => item.status === 'waiting_human' || item.assignedTo === ws.userId);
}

function handleSupportClaim(payload, ws) {
  checkAuth(ws);
  checkStaff(ws);
  const current = supportConversations.getConversation(payload?.conversationId).conversation;
  if (current.assignedTo && current.assignedTo !== ws.userId && ws.user.role !== 'admin') {
    throw new Error(`Conversation is already assigned to ${current.assignedName || 'another representative'}`);
  }
  const createdMessages = [];
  const updated = supportConversations.updateConversation(current.id, ({ conversation, appendMessage }) => {
    conversation.status = 'human_active';
    conversation.botEnabled = false;
    conversation.assignedTo = ws.userId;
    conversation.assignedName = ws.user.name || ws.user.username;
    conversation.claimedBy = ws.userId;
    conversation.resolvedAt = null;
    createdMessages.push(appendMessage({
      senderType: 'system', senderId: 'system', senderName: 'Curva Fabric Support',
      content: `${conversation.assignedName} has joined the conversation as your ${ws.user.role === 'admin' ? 'support administrator' : 'sales representative'}.`,
    }));
  });
  pushSupportUpdate(updated.conversation, createdMessages);
  return { conversation: updated.conversation, messages: createdMessages };
}

function handleSupportTransfer(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);
  const target = readUsers().find((user) => user.id === payload?.toUserId && isStaff(user));
  if (!target) throw new Error('Sales or administrator account not found');
  const createdMessages = [];
  const updated = supportConversations.updateConversation(payload?.conversationId, ({ conversation, appendMessage }) => {
    conversation.status = 'human_active';
    conversation.botEnabled = false;
    conversation.assignedTo = target.id;
    conversation.assignedName = target.name || target.username;
    conversation.claimedBy = ws.userId;
    createdMessages.push(appendMessage({
      senderType: 'system', senderId: 'system', senderName: 'Curva Fabric Support',
      content: `This conversation has been transferred to ${conversation.assignedName}.`,
    }));
  });
  pushSupportUpdate(updated.conversation, createdMessages);
  return { conversation: updated.conversation, messages: createdMessages };
}

function handleSupportResolve(payload, ws) {
  checkAuth(ws);
  const current = supportConversations.getConversation(payload?.conversationId).conversation;
  requireAssignedStaff(current, ws);
  const createdMessages = [];
  const updated = supportConversations.updateConversation(current.id, ({ conversation, appendMessage }) => {
    conversation.status = 'resolved';
    conversation.botEnabled = false;
    conversation.resolvedAt = new Date().toISOString();
    createdMessages.push(appendMessage({
      senderType: 'system', senderId: 'system', senderName: 'Curva Fabric Support',
      content: 'This conversation has been marked as resolved. Send another message whenever you need further assistance.',
    }));
  });
  pushSupportUpdate(updated.conversation, createdMessages);
  return { conversation: updated.conversation, messages: createdMessages };
}

function handleSupportStaffList(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);
  return supportStaffUsers().map((user) => ({ id: user.id, name: user.name || user.username, role: user.role }));
}

//返回WebSocket客服常见问题列表
function handleSupportFAQ() {
  return [
    { id: 1, question: 'What is the typical opening MOQ?', category: 'MOQ' },
    { id: 2, question: 'How do samples and pricing work?', category: 'Commercial' },
    { id: 3, question: 'Can you match a reference fabric?', category: 'Development' },
    { id: 4, question: 'Which private-label elements can be customized?', category: 'Private Label' },
    { id: 5, question: 'What is the typical production lead time?', category: 'Production' },
    { id: 6, question: 'What can pre-shipment QC include?', category: 'Quality' }
  ];
}

// ─── Admin workspace ────────────────────────────
//校验管理员权限并返回脱敏用户列表
function handleAdminUsers(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);
  //移除用户密码后返回安全用户数据
  return readUsers().map(({ password, ...user }) => user);
}

//允许管理员在普通用户与销售员之间调整成员角色
async function handleAdminUpdateUserRole(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);

  const userId = String(payload?.userId || '').trim();
  const role = String(payload?.role || '').trim();
  if (!['user', 'seller'].includes(role)) {
    throw new Error('Role must be user or seller');
  }

  const users = readUsers();
  const target = users.find((user) => user.id === userId);
  if (!target) throw new Error('User not found');
  if (target.role === 'admin') throw new Error('Admin accounts cannot be changed here');

  target.role = role;
  target.updatedAt = new Date().toISOString();
  await writeUsers(users);

  const { password, ...safeUser } = target;
  const token = generateToken(target);
  const connections = clientMap.get(target.id);
  connections?.forEach((client) => {
    client.user = { id: target.id, username: target.username, role: target.role, name: target.name };
    client.userId = target.id;
  });
  sendToUser(target.id, { type: 'auth.role_updated', success: true, data: { user: safeUser, token } });

  return safeUser;
}

//将文章标题或输入值转换为URL标识
function createSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/["'“”]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

//校验管理员权限并返回文章内容记录
function handleAdminArticlesList(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);
  //按更新时间倒序排列文章记录
  return readList(ARTICLES_FILE).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

//校验文章内容并创建管理员文章记录
function handleAdminArticleCreate(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);
  const title = String(payload?.title || '').trim();
  const summary = String(payload?.summary || '').trim();
  const content = String(payload?.content || '').trim();
  const slug = createSlug(payload?.slug || title);
  const category = String(payload?.category || 'knowledge').trim().toLowerCase().slice(0, 40);
  if (title.length < 5 || title.length > 160) throw new Error('Article title must be 5-160 characters');
  if (summary.length < 20 || summary.length > 320) throw new Error('Search summary must be 20-320 characters');
  if (content.length < 100) throw new Error('Article content must be at least 100 characters');
  if (!slug) throw new Error('A valid English URL slug is required');
  const allowedStatuses = ['draft', 'review', 'published'];
  const status = allowedStatuses.includes(payload?.status) ? payload.status : 'draft';
  const articles = readList(ARTICLES_FILE);
  //检查文章URL标识是否重复
  if (articles.some((article) => article.slug === slug)) throw new Error('This article URL slug already exists');
  const now = new Date().toISOString();
  const estimatedMinutes = Math.max(1, Math.ceil(content.split(/\s+/).length / 220));
  const article = {
    id: uuidv4(), title, slug, summary, content, category,
    image: String(payload?.image || '').trim().slice(0, 500), status,
    readTime: `${estimatedMinutes} min read`,
    authorId: ws.userId, authorName: ws.user.name || ws.user.username,
    publishedAt: status === 'published' ? now : null,
    createdAt: now, updatedAt: now,
  };
  articles.push(article);
  writeList(ARTICLES_FILE, articles);
  return article;
}

//删除管理员指定的文章记录
function handleAdminArticleDelete(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);
  const articles = readList(ARTICLES_FILE);
  //查找需要删除的文章索引
  const index = articles.findIndex((article) => article.id === payload?.id);
  if (index === -1) throw new Error('Article record not found');
  const [removed] = articles.splice(index, 1);
  writeList(ARTICLES_FILE, articles);
  return removed;
}

//校验管理员权限并返回FAQ内容记录
function handleAdminFaqsList(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);
  //按更新时间倒序排列FAQ记录
  return readList(FAQS_FILE).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

//校验FAQ内容并创建管理员FAQ记录
function handleAdminFaqCreate(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);
  const question = String(payload?.question || '').trim();
  const answer = String(payload?.answer || '').trim();
  const category = String(payload?.category || 'General').trim().slice(0, 60);
  if (question.length < 10 || question.length > 240) throw new Error('FAQ question must be 10-240 characters');
  if (answer.length < 20 || answer.length > 2000) throw new Error('FAQ answer must be 20-2000 characters');
  const allowedStatuses = ['draft', 'review', 'published'];
  const status = allowedStatuses.includes(payload?.status) ? payload.status : 'draft';
  const now = new Date().toISOString();
  const faq = { id: uuidv4(), question, answer, category, status, authorId: ws.userId, createdAt: now, updatedAt: now };
  const faqs = readList(FAQS_FILE);
  faqs.push(faq);
  writeList(FAQS_FILE, faqs);
  return faq;
}

//删除管理员指定的FAQ记录
function handleAdminFaqDelete(payload, ws) {
  checkAuth(ws);
  checkAdmin(ws);
  const faqs = readList(FAQS_FILE);
  //查找需要删除的FAQ索引
  const index = faqs.findIndex((faq) => faq.id === payload?.id);
  if (index === -1) throw new Error('FAQ record not found');
  const [removed] = faqs.splice(index, 1);
  writeList(FAQS_FILE, faqs);
  return removed;
}

// ─── IM (Instant Messaging) ───────────────────────

//返回可提供即时沟通的销售员列表
function handleGetSales() {
  const users = readUsers();
  //仅销售员作为客户可选择的销售联系人
  return users
    //逐项判断用户是否拥有销售员角色
    .filter(u => u.role === 'seller')
    //将销售账号转换为前端安全字段
    .map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role }));
}

//返回当前用户参与的即时通信房间列表
function handleGetIMRooms(payload, ws) {
  checkAuth(ws);
  const userId = ws.userId;
  const allUsers = readUsers();

  const rooms = [];
  for (const roomId of Object.keys(imRooms)) {
    const room = imRooms[roomId];
    if (room.members.includes(userId)) {
      //查找即时通信房间中的另一位成员
      const otherId = room.members.find(id => id !== userId);
      //根据成员ID查找用户信息
      const otherUser = allUsers.find(u => u.id === otherId);
      rooms.push({
        roomId: room.roomId,
        otherUser: otherUser
          ? { id: otherUser.id, name: otherUser.name, username: otherUser.username, role: otherUser.role }
          : room.memberNames[otherId] || { id: otherId, name: 'Unknown' },
        lastMessage: room.lastMessage,
        updatedAt: room.updatedAt
      });
    }
  }

  // Sort by most recent
  //按最近更新时间倒序排列通信房间
  rooms.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return rooms;
}

//返回指定即时通信房间的最近消息
function handleGetIMMessages(payload, ws) {
  checkAuth(ws);
  const { roomId } = payload || {};
  if (!roomId || !imRooms[roomId]) throw new Error('Conversation not found');
  if (!imRooms[roomId].members.includes(ws.userId)) throw new Error('Access denied');

  return (imMessages[roomId] || []).slice(-100); // Last 100 messages
}

//创建即时通信房间或发送聊天消息
async function handleIMSend(payload, ws) {
  checkAuth(ws);
  let { roomId, toUserId, content } = payload || {};
  if (!content || !content.trim()) throw new Error('Message cannot be empty');

  // Create room if toUserId provided and roomId doesn't exist
  if (!roomId && toUserId) {
    const allUsers = readUsers();
    //根据接收者ID查找目标用户
    const targetUser = allUsers.find(u => u.id === toUserId);
    if (!targetUser) throw new Error('Recipient not found');

    const senderUser = { id: ws.userId, name: ws.user.name || ws.user.username, username: ws.user.username };
    const room = getOrCreateRoom(senderUser, targetUser);
    roomId = room.roomId;
  }

  if (!roomId || !imRooms[roomId]) throw new Error('Conversation not found');
  if (!imRooms[roomId].members.includes(ws.userId)) throw new Error('Access denied');

  const msg = {
    id: uuidv4(),
    roomId,
    senderId: ws.userId,
    senderName: ws.user.name || ws.user.username,
    content: content.trim(),
    timestamp: new Date().toISOString()
  };

  imMessages[roomId].push(msg);
  imRooms[roomId].lastMessage = content.trim().slice(0, 50);
  imRooms[roomId].updatedAt = msg.timestamp;
  await db.upsert('imRooms', roomId, imRooms[roomId]);
  await db.upsert('imMessages', msg.id, msg, roomId);
  await db.recordUserEvent({ userId: ws.userId, eventType: 'im.message_sent', entityType: 'im_room', entityId: roomId });

  // Forward to all room members EXCEPT sender
  const pushMsg = { type: 'im.message', success: true, data: msg };
  //将新消息推送给房间内除发送者外的成员
  imRooms[roomId].members.forEach(memberId => {
    if (memberId !== ws.userId) {
      sendToUser(memberId, pushMsg);
    }
  });

  return msg;
}

// ─── Handler Map ─────────────────────────────────
const handlers = {
  'auth.login':         { fn: handleLogin,         auth: false },
  'auth.register':      { fn: handleRegister,      auth: false },
  'auth.me':            { fn: handleMe,            auth: true  },
  'products.list':      { fn: handleProductList,   auth: false },
  'products.categories':{ fn: handleProductCategories, auth: false },
  'products.get':       { fn: handleProductGet,    auth: false },
  'products.create':    { fn: handleProductCreate, auth: true  },
  'products.update':    { fn: handleProductUpdate, auth: true  },
  'products.delete':    { fn: handleProductDelete, auth: true  },
  'assortment.get':     { fn: handleRfqAssortmentGet,    auth: true  },
  'assortment.add':     { fn: handleRfqAssortmentAdd,    auth: true  },
  'assortment.update':  { fn: handleRfqAssortmentUpdate, auth: true  },
  'assortment.remove':  { fn: handleRfqAssortmentRemove, auth: true  },
  'assortment.clear':   { fn: handleRfqAssortmentClear,  auth: true  },
  'quote.submit':       { fn: handleQuoteSubmit,     auth: true  },
  'support.chat':       { fn: handleSupportChat,   auth: true  },
  'support.faq':        { fn: handleSupportFAQ,    auth: false },
  'support.conversation.get': { fn: handleSupportConversationGet, auth: true },
  'support.message.send': { fn: handleSupportMessageSend, auth: true },
  'support.handoff.request': { fn: handleSupportHandoffRequest, auth: true },
  'support.queue.list': { fn: handleSupportQueueList, auth: true },
  'support.conversation.claim': { fn: handleSupportClaim, auth: true },
  'support.conversation.transfer': { fn: handleSupportTransfer, auth: true },
  'support.conversation.resolve': { fn: handleSupportResolve, auth: true },
  'support.staff.list': { fn: handleSupportStaffList, auth: true },
  'admin.users':        { fn: handleAdminUsers, auth: true },
  'admin.users.update-role': { fn: handleAdminUpdateUserRole, auth: true },
  'admin.articles.list':{ fn: handleAdminArticlesList, auth: true },
  'admin.articles.create': { fn: handleAdminArticleCreate, auth: true },
  'admin.articles.delete': { fn: handleAdminArticleDelete, auth: true },
  'admin.faqs.list':    { fn: handleAdminFaqsList, auth: true },
  'admin.faqs.create':  { fn: handleAdminFaqCreate, auth: true },
  'admin.faqs.delete':  { fn: handleAdminFaqDelete, auth: true },
  'im.sales':           { fn: handleGetSales,      auth: true  },
  'im.rooms':           { fn: handleGetIMRooms,    auth: true  },
  'im.messages':        { fn: handleGetIMMessages, auth: true  },
  'im.send':            { fn: handleIMSend,        auth: true  },
};

// ─── Create WS Server ────────────────────────────
//创建WebSocket服务并注册认证心跳和消息处理
function createWSServer(server) {
  db.list('imRooms').forEach((room) => { imRooms[room.roomId] = room; });
  db.list('imMessages').forEach((message) => {
    if (!imMessages[message.roomId]) imMessages[message.roomId] = [];
    imMessages[message.roomId].push(message);
  });
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Heartbeat interval
  //定时检查并清理失去响应的WebSocket连接
  const heartbeat = setInterval(() => {
    //遍历WebSocket客户端并执行心跳检查
    wss.clients.forEach(ws => {
      if (ws.__alive === false) return ws.terminate();
      ws.__alive = false;
      ws.ping();
    });
  }, 30000);

  //在WebSocket服务关闭时清理心跳定时器
  wss.on('close', () => clearInterval(heartbeat));

  //处理新的WebSocket连接并解析身份令牌
  wss.on('connection', (ws, req) => {
    ws.__alive = true;
    ws.user = null;
    ws.userId = null;

    // Auth via token query param
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        const storedUser = readUsers().find((user) => user.id === decoded.id);
        if (storedUser) {
          ws.user = { id: storedUser.id, username: storedUser.username, role: storedUser.role, name: storedUser.name };
          ws.userId = storedUser.id;
          addClient(storedUser.id, ws);
        }
      }
    } catch (e) { /* invalid/expired token, continue unauthenticated */ }

    //在客户端响应心跳时更新连接存活状态
    ws.on('pong', () => { ws.__alive = true; });

    //在连接关闭时移除用户在线客户端记录
    ws.on('close', () => {
      if (ws.userId) removeClient(ws.userId, ws);
    });

    //解析WebSocket消息并路由到对应业务处理器
    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      }

      const { type, requestId } = msg;
      const handler = handlers[type];

      // Manual auth (allow auth.login/register to set user on ws)
      if (type === 'auth.login' || type === 'auth.register') {
        try {
          const data = await handler.fn(msg.payload, ws);
          ws.send(JSON.stringify({ type, requestId, success: true, data }));
        } catch (err) {
          ws.send(JSON.stringify({ type, requestId, success: false, error: err.message }));
        }
        return;
      }

      if (!handler) {
        return ws.send(JSON.stringify({ type, requestId, success: false, error: `Unknown message type: ${type}` }));
      }

      // Auth check (skip for auth.me since it checks internally)
      if (handler.auth && type !== 'auth.me' && !ws.user) {
        return ws.send(JSON.stringify({ type, requestId, success: false, error: 'Not authenticated' }));
      }

      try {
        const data = await handler.fn(msg.payload, ws);
        ws.send(JSON.stringify({ type, requestId, success: true, data }));
      } catch (err) {
        ws.send(JSON.stringify({ type, requestId, success: false, error: err.message }));
      }
    });

    // Send welcome
    ws.send(JSON.stringify({ type: 'connected', success: true, data: { authenticated: !!ws.user } }));
  });

  console.log('  WebSocket server: ws://localhost:' + (server.address()?.port || '3001') + '/ws');
  return wss;
}

module.exports = createWSServer;
