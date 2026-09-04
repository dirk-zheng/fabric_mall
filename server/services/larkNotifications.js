const crypto = require('crypto');

const SIGNAL_PATTERNS = [
  { type: 'Email', pattern: /\be-?mail\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { type: 'WhatsApp', pattern: /\bwhats(?:app)?\b|wa\.me\//i },
  { type: 'Telegram', pattern: /\btelegram\b|\bt\.me\//i },
  { type: '@', pattern: /@/ },
];

let warnedAboutConfig = false;

function detectContactSignals(message) {
  const content = String(message || '');
  return SIGNAL_PATTERNS
    .filter(({ pattern }) => pattern.test(content))
    .map(({ type }) => type);
}

function buildSignature(timestamp, secret) {
  return crypto
    .createHmac('sha256', `${timestamp}\n${secret}`)
    .update('')
    .digest('base64');
}

function formatValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

async function sendLarkPayload(payload) {
  const webhookUrl = String(process.env.LARK_WEBHOOK_URL || '').trim();
  if (!webhookUrl) {
    if (!warnedAboutConfig) {
      console.warn('Lark notifications are disabled: configure LARK_WEBHOOK_URL.');
      warnedAboutConfig = true;
    }
    return { sent: false, reason: 'lark-not-configured' };
  }

  const secret = String(process.env.LARK_WEBHOOK_SECRET || '').trim();
  if (secret) {
    const signatureTimestamp = Math.floor(Date.now() / 1000);
    payload.timestamp = String(signatureTimestamp);
    payload.sign = buildSignature(signatureTimestamp, secret);
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const responseBody = await response.json().catch(() => ({}));
    const larkCode = responseBody.code ?? responseBody.StatusCode;
    if (!response.ok || (larkCode !== undefined && Number(larkCode) !== 0)) {
      throw new Error(responseBody.msg || responseBody.StatusMessage || `HTTP ${response.status}`);
    }
    return { sent: true };
  } catch (error) {
    console.error(`Lark notification failed: ${error.message}`);
    return { sent: false, reason: 'send-failed' };
  }
}

function sendLarkNotification({ title, fields }) {
  const lines = [title, ...Object.entries(fields).map(([label, value]) => `${label}: ${formatValue(value)}`)];
  return sendLarkPayload({
    msg_type: 'text',
    content: { text: lines.join('\n') },
  });
}

function sendHighIntentCard({ user, message, signals, timestamp }) {
  return sendLarkPayload({
    msg_type: 'interactive',
    card: {
      header: {
        template: 'red',
        title: { tag: 'plain_text', content: 'High intent · Contact request' },
      },
      elements: [
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**Intent**\nHigh intent` } },
            { is_short: true, text: { tag: 'lark_md', content: `**Detected**\n${formatValue(signals)}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**Name**\n${formatValue(user?.name)}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**Account**\n${formatValue(user?.username)}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**User ID**\n${formatValue(user?.id)}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**Time**\n${formatValue(timestamp)}` } },
          ],
        },
        { tag: 'hr' },
        { tag: 'div', text: { tag: 'lark_md', content: `**Message**\n${formatValue(message)}` } },
      ],
    },
  });
}

function notifyRobotChat({ user, message, matchedKeyword, timestamp }) {
  const signals = detectContactSignals(message);
  if (signals.length) return sendHighIntentCard({ user, message, signals, timestamp });

  return sendLarkNotification({
    title: '[Curva Fabric] New support chat',
    fields: {
      Type: 'Robot chat',
      Name: user?.name,
      Account: user?.username,
      'User ID': user?.id,
      Message: message,
      'Matched topic': matchedKeyword,
      Time: timestamp,
    },
  });
}

function notifyQuoteInquiry(quote) {
  const customer = quote.customer || {};
  const itemSummary = Array.isArray(quote.items)
    ? quote.items.map((item) => `${item.name || item.productId} × ${item.quantity}`).join('; ')
    : '';

  return sendLarkNotification({
    title: `[Curva Fabric] New inquiry ${formatValue(quote.reference)}`,
    fields: {
      Type: 'Quote inquiry',
      Reference: quote.reference,
      Source: quote.source || 'member RFQ assortment',
      Name: customer.name,
      Company: customer.company,
      Country: customer.country,
      Email: customer.email || customer.username,
      WhatsApp: customer.whatsapp,
      'Business type': quote.buyerProfile?.businessType,
      'Sales channels': quote.buyerProfile?.salesChannels,
      Website: quote.buyerProfile?.websiteUrl,
      'Target retail price': quote.buyerProfile?.targetRetailPrice,
      'Annual denim volume': quote.buyerProfile?.annualVolume,
      'Product category': quote.productCategory,
      Market: quote.market,
      'Target customer profile': quote.targetCustomerProfile,
      Specifications: quote.specifications,
      Quantity: quote.estimatedQuantity,
      'Delivery destination': quote.deliveryDestination,
      'Target delivery': quote.targetDelivery,
      Items: itemSummary,
      Notes: quote.notes,
      Time: quote.createdAt,
    },
  });
}

function notifyLarkContactMessage({ user, message, timestamp }) {
  const signals = detectContactSignals(message);
  if (!signals.length) return Promise.resolve({ sent: false, reason: 'no-contact-signal' });

  return sendHighIntentCard({ user, message, signals, timestamp });
}

module.exports = {
  buildSignature,
  detectContactSignals,
  notifyLarkContactMessage,
  notifyQuoteInquiry,
  notifyRobotChat,
  sendHighIntentCard,
  sendLarkNotification,
  sendLarkPayload,
};
