const test = require('node:test');
const assert = require('node:assert/strict');
const { createTotp, generateTotpCode, verifyTotp } = require('../services/totp');

test('creates standards-compatible TOTP setup details and verifies a current code', () => {
  const now = Date.UTC(2026, 8, 9, 12, 0, 0);
  const setup = createTotp('seller@example.com');
  assert.match(setup.secret, /^[A-Z2-7]{32}$/);
  assert.match(setup.uri, /^otpauth:\/\/totp\/Curva%20Fabric%3Aseller%40example.com\?/);
  const code = generateTotpCode(setup.secret, Math.floor(now / 30_000));
  assert.equal(verifyTotp(setup.secret, code, now), true);
  assert.equal(verifyTotp(setup.secret, '00000x', now), false);
});
