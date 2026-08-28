import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const storage = new Map();
globalThis.crypto ??= webcrypto;
globalThis.location = { protocol: 'http:', host: 'localhost:5173' };
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.sent = [];
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  send(message) {
    this.sent.push(message);
  }

  close() {
    this.readyState = MockWebSocket.CLOSING;
    queueMicrotask(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.({ code: 1000 });
    });
  }

  respond(message) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  drop() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1006 });
  }
}

globalThis.WebSocket = MockWebSocket;

const { default: wsClient } = await import('../src/api/ws.js');

// Calling connect repeatedly while CONNECTING or OPEN must reuse one socket.
const firstRequest = wsClient.send('products.list');
const firstSocket = MockWebSocket.instances[0];
wsClient._connect();
assert.equal(MockWebSocket.instances.length, 1);
firstSocket.open();
wsClient._connect();
assert.equal(MockWebSocket.instances.length, 1);
const firstMessage = JSON.parse(firstSocket.sent[0]);
firstSocket.respond({ requestId: firstMessage.requestId, success: true, data: [] });
assert.deepEqual(await firstRequest, []);

// An old socket's delayed close event must not schedule a second replacement.
localStorage.setItem('mall_user', JSON.stringify({ token: 'test-token' }));
wsClient.setToken('test-token');
const secondSocket = MockWebSocket.instances[1];
await Promise.resolve();
assert.equal(MockWebSocket.instances.length, 2);
assert.equal(wsClient._reconnectTimer, null);
secondSocket.open();

// A queued request that times out must never be sent after the socket opens.
wsClient.disconnect();
await Promise.resolve();
const timedOutRequest = wsClient.send('quote.create', {}, 10);
const thirdSocket = MockWebSocket.instances[2];
await assert.rejects(timedOutRequest, /Request timeout/);
thirdSocket.open();
assert.equal(thirdSocket.sent.length, 0);

// A network loss rejects requests, then schedules exactly one reconnect.
wsClient._maxReconnectDelay = 1;
const interruptedRequest = wsClient.send('products.list');
assert.equal(thirdSocket.sent.length, 1);
thirdSocket.drop();
await assert.rejects(interruptedRequest, /Connection lost/);
const reconnectTimer = wsClient._reconnectTimer;
assert.ok(reconnectTimer);
wsClient._scheduleReconnect();
assert.equal(wsClient._reconnectTimer, reconnectTimer);
await new Promise(resolve => setTimeout(resolve, 10));
assert.equal(MockWebSocket.instances.length, 4);
wsClient._ensureConnection();
assert.equal(MockWebSocket.instances.length, 4);
wsClient.disconnect();

console.log('WebSocket client regression tests passed.');
