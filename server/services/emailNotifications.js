const nodemailer = require('nodemailer');

const ADMIN_EMAIL = String(process.env.ADMIN_NOTIFICATION_EMAIL || '812353475@qq.com').trim();
const SMTP_HOST = String(process.env.SMTP_HOST || 'smtp.qq.com').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = String(process.env.SMTP_USER || ADMIN_EMAIL).trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '');
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false';

let warnedAboutConfig = false;
let transporter;

function getTransporter() {
  if (!SMTP_USER || !SMTP_PASS) {
    if (!warnedAboutConfig) {
      console.warn('Email notifications are disabled: configure SMTP_USER and SMTP_PASS.');
      warnedAboutConfig = true;
    }
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

function cleanHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 160);
}

function formatValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

async function sendAdminNotification({ subject, fields, replyTo }) {
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: 'smtp-not-configured' };

  const text = Object.entries(fields)
    .map(([label, value]) => `${label}: ${formatValue(value)}`)
    .join('\n');

  try {
    const info = await mailer.sendMail({
      from: `"Curva Fabric Website" <${SMTP_USER}>`,
      to: ADMIN_EMAIL,
      replyTo: replyTo || undefined,
      subject: cleanHeader(subject),
      text,
    });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Admin email notification failed: ${error.message}`);
    return { sent: false, reason: 'send-failed' };
  }
}

function notifyRobotChat({ user, message, matchedKeyword, timestamp }) {
  return sendAdminNotification({
    subject: `[Curva Fabric] New support chat - ${user?.name || user?.username || 'User'}`,
    replyTo: String(user?.username || '').includes('@') ? user.username : undefined,
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

  return sendAdminNotification({
    subject: `[Curva Fabric] New inquiry ${quote.reference}`,
    replyTo: customer.email || (String(customer.username || '').includes('@') ? customer.username : undefined),
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

module.exports = { notifyRobotChat, notifyQuoteInquiry };
