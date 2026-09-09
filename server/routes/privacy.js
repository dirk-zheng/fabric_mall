const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { findAccount, normalizeAccount, normalizeVisitorId } = require('../services/identity');

const router = express.Router();
const POLICY_VERSION = '2026-09-09';
const ALLOWED_CONSENTS = new Set(['privacy_notice', 'terms', 'age_business_user', 'marketing_email', 'marketing_phone', 'sale_sharing_opt_out']);

router.post('/consents', async (req, res) => {
  try {
    const visitorId = normalizeVisitorId(req.body?.visitorId || req.get('x-visitor-id'));
    const consentType = String(req.body?.consentType || '');
    if (!ALLOWED_CONSENTS.has(consentType)) return res.status(400).json({ code: 400, message: 'Unsupported consent type.' });
    const consent = await db.recordConsent({
      visitorId,
      consentType,
      granted: Boolean(req.body?.granted),
      policyVersion: POLICY_VERSION,
      data: { source: String(req.body?.source || 'privacy-center').slice(0, 100) },
    });
    res.status(201).json({ code: 201, data: consent });
  } catch (error) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

router.get('/export', authenticateToken, async (req, res) => {
  try {
    const data = await db.exportAccountData(req.user.account);
    res.set('Content-Disposition', `attachment; filename="curva-account-export-${Date.now()}.json"`);
    res.json({ code: 200, data });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Unable to prepare the data export.' });
  }
});

router.get('/consents', authenticateToken, async (req, res) => {
  try {
    const behavior = await db.listUserBehavior(req.user.account);
    const consents = await db.listConsents(behavior.visitorIds);
    res.json({ code: 200, data: { visitorIds: behavior.visitorIds, consents } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Unable to load privacy preferences.' });
  }
});

router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const updated = await db.updateAccountProfile(req.user.account, req.body?.name);
    res.json({ code: 200, data: updated });
  } catch (error) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

router.delete('/account', authenticateToken, async (req, res) => {
  try {
    if (req.body?.confirmation !== 'DELETE') return res.status(400).json({ code: 400, message: 'Enter DELETE to confirm.' });
    const account = normalizeAccount(req.user.account);
    await db.refreshUsersByAccount(account);
    const user = findAccount(account);
    if (!user || !await bcrypt.compare(String(req.body?.password || ''), user.password)) {
      return res.status(403).json({ code: 403, message: 'Password verification failed.' });
    }
    const result = await db.deleteAccountData(account);
    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

module.exports = router;
