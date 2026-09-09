const crypto = require('crypto');

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let index = 0; index < bits.length; index += 5) output += alphabet[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  return output;
}

function decodeBase32(value) {
  let bits = '';
  for (const character of String(value || '').replace(/=+$/g, '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid MFA secret.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

function codeAt(secret, counter) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, '0');
}

function verifyTotp(secret, candidate, now = Date.now()) {
  const code = String(candidate || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(now / 30_000);
  return [-1, 0, 1].some((offset) => {
    const expected = codeAt(secret, counter + offset);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code));
  });
}

function createTotp(account) {
  const secret = encodeBase32(crypto.randomBytes(20));
  const label = encodeURIComponent(`Curva Fabric:${account}`);
  return { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Curva Fabric')}&algorithm=SHA1&digits=6&period=30` };
}

module.exports = { createTotp, generateTotpCode: codeAt, verifyTotp };
