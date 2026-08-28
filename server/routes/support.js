const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { notifyRobotChat } = require('../services/emailNotifications');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// AI Keyword matching configuration
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
    response: 'Fabric Documents 📄\n\nComposition, weight, width, physical tests, packing and available supporting documents are confirmed by quality and order.'
  },
  {
    keywords: ['price', 'cost', 'how much', 'cheap', 'discount', 'promotion', 'pricing', 'quote'],
    response: 'Practical Fabric Quotation 💰\n\nSend the composition, weight, stretch, shade, finish and estimated meters. Pricing follows the confirmed specification and volume.'
  },
  {
    keywords: ['shipping', 'delivery', 'logistics', 'transport', 'how long', 'freight', 'tracking'],
    response: 'Order & Export Support 🚢\n\nRoll packing, marks, commercial documents and export coordination follow the confirmed order and Incoterms. Destination requirements are agreed before shipment.'
  },
  {
    keywords: ['return', 'refund', 'warranty', 'quality', 'damage', 'defect', 'exchange', 'inspect', 'inspection', 'qc', 'measurement', 'shade', 'stitching', 'hardware'],
    response: 'Denim Fabric Quality 🛡️\n\nInspection can cover the four-point system, shade, width, weight, shrinkage, skew, strength, stretch and packing. Claims and remedies follow the agreed terms.'
  },
  {
    keywords: ['payment', 'pay', 'method', 'wire', 'bank', 'credit', 'terms', 'TT', 'LC'],
    response: 'Order Terms 💳\n\nPayment terms are confirmed clearly in the quotation and proforma invoice for each order. We keep order, QC, loading and document requirements aligned before shipment.'
  }
];

// Default fallback replies
const defaultReplies = [
  'Thank you for contacting Curva Fabric. Ask about MOQ, swatches, pricing, technical data or custom development.',
  'Hello! Share your end use, composition, weight, stretch, order meters and delivery window.',
  'Welcome to Curva Fabric. We support brands, garment factories and fabric buyers worldwide.'
];

// Get AI response based on keywords
//根据用户消息关键词生成客服回复
function getAIResponse(userMessage) {
  const lowerMessage = userMessage.toLowerCase();

  for (const rule of keywordRules) {
    for (const keyword of rule.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return { reply: rule.response, matchedKeyword: keyword };
      }
    }
  }

  // Random default reply
  const randomReply = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
  return { reply: randomReply, matchedKeyword: null };
}

// POST /api/support/chat - Send message and get AI reply
//接收客服消息并返回关键词匹配结果
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ code: 400, message: 'Message cannot be empty' });
    }

    const userMessage = message.trim();
    const result = getAIResponse(userMessage);
    const timestamp = new Date().toISOString();
    const messageId = uuidv4();
    await db.upsert('supportMessages', messageId, {
      id: messageId, userId: req.user.id, userMessage, aiReply: result.reply,
      matchedKeyword: result.matchedKeyword, createdAt: timestamp,
    });
    await db.recordUserEvent({
      userId: req.user.id, eventType: 'support.chat_message', entityType: 'support_message',
      entityId: messageId, ip: req.ip, userAgent: req.get('user-agent')
    });
    void notifyRobotChat({ user: req.user, message: userMessage, matchedKeyword: result.matchedKeyword, timestamp });

    res.json({
      code: 200,
      data: {
        userMessage,
        aiReply: result.reply,
        matchedKeyword: result.matchedKeyword,
        timestamp
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// GET /api/support/faq - Get frequently asked questions
//返回客服模块常见问题列表
router.get('/faq', (req, res) => {
  const faqFile = path.join(__dirname, '..', 'data', 'faqs.json');
  const faqs = JSON.parse(fs.readFileSync(faqFile, 'utf8'));
  res.json({
    code: 200,
    data: faqs.filter((faq) => faq.published !== false)
  });
});

module.exports = router;
