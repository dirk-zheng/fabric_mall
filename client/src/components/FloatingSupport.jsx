import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Clock, Headphones, Loader2, Send, ShieldCheck, UserRound, X } from 'lucide-react';
import { supportAPI, wsClient } from '../api';
import { useAuth } from '../context/AuthContext';

const quickQuestions = [
  'What is the typical fabric MOQ?',
  'How do swatches and pricing work?',
  'Can you match a reference fabric?',
  'Which technical tests are available?',
];

const firstVisitGreeting = 'Hello, we’re working hard to find a human support agent for you…';

function localMessage(senderType, content) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    senderType,
    senderId: senderType === 'customer' ? 'guest' : 'bot',
    senderName: senderType === 'customer' ? 'Guest' : 'Kora · AI Assistant',
    content,
    createdAt: new Date().toISOString(),
  };
}

const statusCopy = {
  bot_active: { label: 'AI assistant', tone: 'bg-emerald-100 text-emerald-700' },
  waiting_human: { label: 'Waiting for sales', tone: 'bg-amber-100 text-amber-700' },
  human_active: { label: 'Sales connected', tone: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Resolved', tone: 'bg-slate-100 text-slate-600' },
};

function mergeMessages(current, incoming = []) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => message?.id && byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message, customerId }) {
  if (message.senderType === 'system') {
    return <div className="flex justify-center"><p className="max-w-[90%] rounded-full bg-slate-100 px-3 py-1.5 text-center text-xs text-slate-500">{message.content}</p></div>;
  }
  const isCustomer = message.senderType === 'customer' || message.senderId === customerId;
  const isBot = message.senderType === 'bot';
  return (
    <div className={`flex gap-2 ${isCustomer ? 'flex-row-reverse' : ''}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white ${isCustomer ? 'bg-primary' : isBot ? 'bg-slate-800' : 'bg-emerald-600'}`}>
        {isBot ? <Bot size={16} /> : isCustomer ? <UserRound size={16} /> : <Headphones size={16} />}
      </div>
      <div className={`max-w-[78%] ${isCustomer ? 'text-right' : ''}`}>
        {!isCustomer && <p className="mb-1 text-xs font-medium text-slate-500">{message.senderName}</p>}
        <div className={`inline-block rounded-2xl px-3 py-2 text-left text-sm whitespace-pre-wrap ${isCustomer ? 'rounded-tr-sm bg-primary text-white' : 'rounded-tl-sm border border-slate-200 bg-white text-slate-700 shadow-sm'}`}>{message.content}</div>
        <p className={`mt-1 flex items-center gap-1 text-[10px] text-slate-400 ${isCustomer ? 'justify-end' : ''}`}><Clock size={9} />{formatTime(message.createdAt)}</p>
      </div>
    </div>
  );
}

export default function FloatingSupport({ isOpen, onClose }) {
  const { user } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const applyResult = useCallback((result) => {
    if (result?.conversation) setConversation(result.conversation);
    if (result?.messages) setMessages((current) => mergeMessages(current, result.messages));
  }, []);

  useEffect(() => {
    if (!isOpen || !user?.token) return;
    setLoading(true);
    setError('');
    supportAPI.getConversation().then((result) => {
      setConversation(result.conversation);
      setMessages(result.messages || []);
    }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, [isOpen, user?.id, user?.token]);

  useEffect(() => {
    if (isOpen && !user?.token && messages.length === 0) setMessages([localMessage('bot', firstVisitGreeting)]);
  }, [isOpen, user?.token, messages.length]);

  useEffect(() => {
    const offMessage = wsClient.on('support.message.created', (message) => {
      if (!conversation || message.conversationId === conversation.id) setMessages((current) => mergeMessages(current, [message]));
    });
    const offConversation = wsClient.on('support.conversation.updated', (updated) => {
      if (!conversation || updated.id === conversation.id) setConversation(updated);
    });
    return () => { offMessage(); offConversation(); };
  }, [conversation?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);
    setError('');
    try {
      if (user?.token) {
        applyResult(await supportAPI.sendMessage(content, conversation?.id));
      } else {
        setMessages((current) => mergeMessages(current, [localMessage('customer', content)]));
        const result = await supportAPI.chat(content);
        setMessages((current) => mergeMessages(current, [localMessage('bot', result.aiReply)]));
      }
    }
    catch (requestError) { setInput(content); setError(requestError.message); }
    finally { setSending(false); }
  };

  const requestHuman = async () => {
    setSending(true);
    setError('');
    try { applyResult(await supportAPI.requestHuman()); }
    catch (requestError) { setError(requestError.message); }
    finally { setSending(false); }
  };

  if (!isOpen) return null;
  const status = statusCopy[conversation?.status] || statusCopy.bot_active;
  const humanActive = conversation?.status === 'human_active';
  const waiting = conversation?.status === 'waiting_human';

  return (
    <section className="fixed bottom-[218px] right-3 z-50 flex h-[570px] max-h-[calc(100vh-234px)] w-[calc(100vw-1.5rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-6" aria-label="Curva Fabric buyer support">
      <header className="flex items-center justify-between bg-gradient-to-r from-primary to-secondary px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">{humanActive ? <Headphones size={21} /> : <Bot size={21} />}</div>
          <div><h2 className="text-sm font-bold">{humanActive ? conversation.assignedName : 'Curva Fabric Assistant'}</h2><p className="text-xs text-white/80">{humanActive ? 'Fabric Specialist' : waiting ? 'Connecting you with sales' : 'B2B Assistant · Curva Fabric'}</p></div>
        </div>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25" aria-label="Close support chat"><X size={18} /></button>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={28} /></div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
            {user?.token && !humanActive && !waiting && <button type="button" onClick={requestHuman} disabled={sending} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-50"><Headphones size={14} />Talk to Sales</button>}
            {waiting && <span className="text-xs text-amber-700">A representative will join here</span>}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-white to-blue-50/30 p-4">
            {messages.map((message) => <MessageBubble key={message.id} message={message} customerId={user?.id || 'guest'} />)}
            {sending && <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={13} className="animate-spin" />Sending…</div>}
            <div ref={endRef} />
          </div>
          {!humanActive && !waiting && messages.length <= 3 && <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-3 py-2">{quickQuestions.map((question) => <button key={question} type="button" onClick={() => setInput(question)} className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-primary hover:text-primary">{question}</button>)}</div>}
          {error && <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">{error}</p>}
          <div className="border-t border-slate-200 p-3">
            <div className="flex gap-2">
              <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} disabled={sending} maxLength={3000} placeholder={waiting ? 'Add more details for the sales team…' : 'Type your message…'} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10" />
              <button type="button" onClick={sendMessage} disabled={!input.trim() || sending} className="flex h-10 w-11 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-40" aria-label="Send message"><Send size={17} /></button>
            </div>
            <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-slate-400"><ShieldCheck size={11} />Human representatives are clearly identified when they join.</p>
          </div>
        </>
      )}
    </section>
  );
}
