const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSignature,
  detectContactSignals,
  notifyLarkContactMessage,
  notifyQuoteInquiry,
  notifyRobotChat,
} = require('../services/larkNotifications');
const { getGuestChatUsage } = require('../services/guestChatLimits');

test('guest chat starts registration prompts at message 7 and locks at 10', () => {
  assert.deepEqual(getGuestChatUsage(6), {
    sentCount: 6, remaining: 4, registrationSuggested: false, limitReached: false,
  });
  assert.deepEqual(getGuestChatUsage(7), {
    sentCount: 7, remaining: 3, registrationSuggested: true, limitReached: false,
  });
  assert.deepEqual(getGuestChatUsage(10), {
    sentCount: 10, remaining: 0, registrationSuggested: true, limitReached: true,
  });
});

test('detects @, email, WhatsApp and Telegram contact signals', () => {
  assert.deepEqual(detectContactSignals('Please email buyer@example.com'), ['Email', '@']);
  assert.deepEqual(detectContactSignals('Can I send this by e-mail?'), ['Email']);
  assert.deepEqual(detectContactSignals('Contact me on WhatsApp or wa.me/8613800138000'), ['WhatsApp']);
  assert.deepEqual(detectContactSignals('Telegram: t.me/fabricbuyer'), ['Telegram']);
  assert.deepEqual(detectContactSignals('@fabricbuyer'), ['@']);
  assert.deepEqual(detectContactSignals('What is the MOQ?'), []);
});

test('creates the Lark custom bot signature', () => {
  const expected = require('crypto')
    .createHmac('sha256', '1599360473\ntest-secret')
    .update('')
    .digest('base64');
  assert.equal(buildSignature(1599360473, 'test-secret'), expected);
});

test('pushes matching chat content to the configured Lark webhook', async (t) => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.LARK_WEBHOOK_URL;
  const originalSecret = process.env.LARK_WEBHOOK_SECRET;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.LARK_WEBHOOK_URL;
    else process.env.LARK_WEBHOOK_URL = originalUrl;
    if (originalSecret === undefined) delete process.env.LARK_WEBHOOK_SECRET;
    else process.env.LARK_WEBHOOK_SECRET = originalSecret;
  });

  process.env.LARK_WEBHOOK_URL = 'https://open.larksuite.com/open-apis/bot/v2/hook/test';
  process.env.LARK_WEBHOOK_SECRET = '';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ code: 0 }) };
  };

  const result = await notifyLarkContactMessage({
    user: { id: 'u-1', name: 'Buyer', username: 'buyer' },
    message: 'My Telegram is @fabricbuyer',
    timestamp: '2026-09-04T00:00:00.000Z',
  });

  assert.deepEqual(result, { sent: true });
  assert.equal(request.url, process.env.LARK_WEBHOOK_URL);
  const body = JSON.parse(request.options.body);
  assert.equal(body.msg_type, 'interactive');
  assert.equal(body.card.header.template, 'red');
  assert.match(body.card.header.title.content, /High intent/);
  assert.match(JSON.stringify(body.card), /Telegram, @/);
  assert.match(JSON.stringify(body.card), /My Telegram is @fabricbuyer/);
});

test('does not call Lark for ordinary chat content', async (t) => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.LARK_WEBHOOK_URL;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.LARK_WEBHOOK_URL;
    else process.env.LARK_WEBHOOK_URL = originalUrl;
  });

  process.env.LARK_WEBHOOK_URL = 'https://open.larksuite.com/open-apis/bot/v2/hook/test';
  global.fetch = async () => { throw new Error('fetch should not be called'); };
  const result = await notifyLarkContactMessage({ message: 'Can I get a fabric sample?' });
  assert.deepEqual(result, { sent: false, reason: 'no-contact-signal' });
});

test('pushes every robot chat through the main notification flow', async (t) => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.LARK_WEBHOOK_URL;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.LARK_WEBHOOK_URL;
    else process.env.LARK_WEBHOOK_URL = originalUrl;
  });

  process.env.LARK_WEBHOOK_URL = 'https://open.larksuite.com/open-apis/bot/v2/hook/test';
  let payload;
  global.fetch = async (url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ code: 0 }) };
  };

  const result = await notifyRobotChat({
    user: { id: 'u-2', name: 'Buyer Two', username: 'buyer2' },
    message: 'What is the MOQ?',
    matchedKeyword: 'moq',
    timestamp: '2026-09-04T01:00:00.000Z',
  });

  assert.deepEqual(result, { sent: true });
  assert.match(payload.content.text, /New support chat/);
  assert.match(payload.content.text, /Message: What is the MOQ\?/);
  assert.match(payload.content.text, /Matched topic: moq/);
});

test('pushes robot chat contact details as a High intent card', async (t) => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.LARK_WEBHOOK_URL;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.LARK_WEBHOOK_URL;
    else process.env.LARK_WEBHOOK_URL = originalUrl;
  });

  process.env.LARK_WEBHOOK_URL = 'https://open.larksuite.com/open-apis/bot/v2/hook/test';
  let payload;
  global.fetch = async (url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ code: 0 }) };
  };

  const result = await notifyRobotChat({
    user: { id: 'u-3', name: 'Buyer Three', username: 'buyer3' },
    message: 'Email me at buyer3@example.com',
    timestamp: '2026-09-04T01:30:00.000Z',
  });

  assert.deepEqual(result, { sent: true });
  assert.equal(payload.msg_type, 'interactive');
  assert.equal(payload.card.header.title.content, 'High intent · Contact request');
  assert.match(JSON.stringify(payload.card), /buyer3@example\.com/);
});

test('pushes quote inquiries with customer and product details', async (t) => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.LARK_WEBHOOK_URL;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.LARK_WEBHOOK_URL;
    else process.env.LARK_WEBHOOK_URL = originalUrl;
  });

  process.env.LARK_WEBHOOK_URL = 'https://open.larksuite.com/open-apis/bot/v2/hook/test';
  let payload;
  global.fetch = async (url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ code: 0 }) };
  };

  const result = await notifyQuoteInquiry({
    reference: 'RFQ-TEST-001',
    customer: { name: 'Buyer', email: 'buyer@example.com', whatsapp: '+86 138 0013 8000' },
    items: [{ name: 'Stretch Denim', quantity: 1000 }],
    estimatedQuantity: 1000,
    createdAt: '2026-09-04T02:00:00.000Z',
  });

  assert.deepEqual(result, { sent: true });
  assert.match(payload.content.text, /New inquiry RFQ-TEST-001/);
  assert.match(payload.content.text, /Email: buyer@example\.com/);
  assert.match(payload.content.text, /Items: Stretch Denim × 1000/);
});
