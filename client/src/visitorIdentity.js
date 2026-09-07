const VISITOR_ID_KEY = 'curva_visitor_id';
const LEGACY_CHAT_USAGE_KEY = 'curva_guest_chat_usage';

export function getOrCreateVisitorId() {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(VISITOR_ID_KEY);
  if (/^[a-zA-Z0-9-]{16,64}$/.test(existing || '')) return existing;

  let visitorId = '';
  try {
    visitorId = JSON.parse(localStorage.getItem(LEGACY_CHAT_USAGE_KEY) || '{}').visitorId || '';
  } catch { /* ignore invalid legacy state */ }
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(visitorId)) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  localStorage.setItem(VISITOR_ID_KEY, visitorId);
  return visitorId;
}

export { VISITOR_ID_KEY };
