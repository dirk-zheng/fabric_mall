import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock, Headphones, Inbox, Loader2, RefreshCw, Send, UserRound } from 'lucide-react';
import { supportAPI, wsClient } from '../api';
import { useAuth } from '../context/AuthContext';

const statusLabels = {
  bot_active: 'Bot active',
  waiting_human: 'Waiting',
  human_active: 'In progress',
  resolved: 'Resolved',
};

function mergeMessages(current, incoming = []) {
  const messages = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => item?.id && messages.set(item.id, item));
  return [...messages.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function shortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SupportInbox() {
  const { user } = useAuth();
  const admin = user.role === 'admin';
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [staff, setStaff] = useState([]);
  const [filter, setFilter] = useState('open');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const loadQueue = useCallback(async () => {
    try {
      const items = await supportAPI.getQueue();
      setConversations(items);
      setSelected((current) => current ? items.find((item) => item.id === current.id) || current : current);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    if (admin) supportAPI.getStaff().then(setStaff).catch(() => setStaff([]));
  }, [loadQueue, admin]);

  useEffect(() => {
    const offConversation = wsClient.on('support.conversation.updated', (updated) => {
      setConversations((current) => {
        const next = current.filter((item) => item.id !== updated.id);
        if (updated.status !== 'closed' && (admin || updated.status === 'waiting_human' || updated.assignedTo === user.id)) next.unshift(updated);
        return next.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
      if (selected?.id === updated.id) setSelected(updated);
    });
    const offMessage = wsClient.on('support.message.created', (message) => {
      if (selected?.id === message.conversationId) setMessages((current) => mergeMessages(current, [message]));
    });
    return () => { offConversation(); offMessage(); };
  }, [selected?.id, user.id, admin]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const openConversation = async (conversation) => {
    setSelected(conversation);
    setMessages([]);
    setError('');
    try {
      const result = await supportAPI.getConversation(conversation.id);
      setSelected(result.conversation);
      setMessages(result.messages || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const runAction = async (action) => {
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (result?.conversation) setSelected(result.conversation);
      if (result?.messages) setMessages((current) => mergeMessages(current, result.messages));
      await loadQueue();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !selected || busy) return;
    setInput('');
    await runAction(() => supportAPI.sendMessage(content, selected.id));
  };

  const filtered = useMemo(() => conversations.filter((conversation) => {
    if (filter === 'waiting') return conversation.status === 'waiting_human';
    if (filter === 'mine') return conversation.assignedTo === user.id;
    if (filter === 'resolved') return conversation.status === 'resolved';
    return conversation.status !== 'resolved';
  }), [conversations, filter, user.id]);

  const canReply = selected?.assignedTo === user.id && selected?.status === 'human_active';
  const canClaim = selected && selected.status !== 'resolved' && selected.assignedTo !== user.id;

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-10 pt-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Buyer support</p><h1 className="mt-1 font-heading text-3xl font-bold text-slate-900">Wholesale Inquiry Inbox</h1><p className="mt-1 text-sm text-slate-500">Claim buyer requests, keep the bot context and reply as a clearly identified team member.</p></div>
          <button type="button" onClick={loadQueue} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary"><RefreshCw size={16} />Refresh</button>
        </div>

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="grid min-h-[650px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[320px_minmax(0,1fr)_260px]">
          <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-100 p-3">
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {[['open', 'Open'], ['waiting', 'Waiting'], ['mine', 'Mine'], ['resolved', 'Done']].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold ${filter === value ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>{label}</button>)}
              </div>
            </div>
            <div className="max-h-[590px] overflow-y-auto">
              {loading && <div className="flex justify-center py-12 text-slate-400"><Loader2 className="animate-spin" /></div>}
              {!loading && filtered.length === 0 && <div className="px-6 py-14 text-center text-slate-400"><Inbox className="mx-auto mb-3" size={32} /><p className="text-sm">No conversations in this queue.</p></div>}
              {filtered.map((conversation) => <button key={conversation.id} onClick={() => openConversation(conversation)} className={`w-full border-b border-slate-100 px-4 py-4 text-left hover:bg-orange-50/50 ${selected?.id === conversation.id ? 'bg-orange-50' : ''}`}>
                <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-900">{conversation.customerName}</p><span className="shrink-0 text-[10px] text-slate-400">{shortTime(conversation.lastMessageAt)}</span></div>
                <p className="mt-1 truncate text-xs text-slate-500">{conversation.lastMessage || 'New conversation'}</p>
                <div className="mt-2 flex items-center justify-between"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${conversation.status === 'waiting_human' ? 'bg-amber-100 text-amber-700' : conversation.status === 'human_active' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{statusLabels[conversation.status]}</span>{conversation.assignedName && <span className="truncate text-[10px] text-slate-400">{conversation.assignedName}</span>}</div>
              </button>)}
            </div>
          </aside>

          <main className="flex min-h-[520px] flex-col">
            {!selected ? <div className="flex flex-1 flex-col items-center justify-center px-8 text-center text-slate-400"><Headphones size={42} className="mb-4 text-slate-300" /><p className="font-semibold text-slate-600">Select a conversation</p><p className="mt-1 text-sm">Waiting conversations can be claimed by one representative at a time.</p></div> : <>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div><h2 className="font-semibold text-slate-900">{selected.customerName}</h2><p className="text-xs text-slate-500">@{selected.customerUsername} · {statusLabels[selected.status]}</p></div>
                <div className="flex gap-2">{canClaim && <button type="button" disabled={busy} onClick={() => runAction(() => supportAPI.claimConversation(selected.id))} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{selected.assignedTo && admin ? 'Take over' : 'Claim conversation'}</button>}{selected.status === 'human_active' && (canReply || admin) && <button type="button" disabled={busy} onClick={() => runAction(() => supportAPI.resolveConversation(selected.id))} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"><CheckCircle2 size={14} />Resolve</button>}</div>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-4">
                {messages.map((message) => message.senderType === 'system' ? <p key={message.id} className="mx-auto max-w-lg rounded-full bg-slate-200/70 px-3 py-1.5 text-center text-xs text-slate-500">{message.content}</p> : <div key={message.id} className={`flex ${['seller', 'admin'].includes(message.senderType) ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] rounded-2xl px-3 py-2 ${['seller', 'admin'].includes(message.senderType) ? 'rounded-tr-sm bg-primary text-white' : 'rounded-tl-sm border border-slate-200 bg-white text-slate-700'}`}><p className={`mb-1 text-[10px] font-semibold ${['seller', 'admin'].includes(message.senderType) ? 'text-white/70' : 'text-slate-400'}`}>{message.senderName}</p><p className="whitespace-pre-wrap text-sm">{message.content}</p><p className={`mt-1 text-[10px] ${['seller', 'admin'].includes(message.senderType) ? 'text-white/60' : 'text-slate-400'}`}>{shortTime(message.createdAt)}</p></div></div>)}
                <div ref={endRef} />
              </div>
              <div className="border-t border-slate-200 p-3"><div className="flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); sendMessage(); } }} disabled={!canReply || busy} placeholder={canReply ? 'Reply as yourself…' : 'Claim this conversation before replying'} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100" /><button onClick={sendMessage} disabled={!canReply || !input.trim() || busy} className="flex w-11 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-40"><Send size={17} /></button></div></div>
            </>}
          </main>

          <aside className="border-t border-slate-200 bg-slate-50/60 p-5 lg:border-l lg:border-t-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Customer details</h3>
            {selected ? <div className="mt-4 space-y-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound size={19} /></div><div><p className="text-sm font-semibold text-slate-900">{selected.customerName}</p><p className="text-xs text-slate-500">@{selected.customerUsername}</p></div></div><div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600"><p className="font-semibold text-slate-900">Assigned to</p><p className="mt-1">{selected.assignedName || 'Unassigned'}</p></div><div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600"><p className="flex items-center gap-1 font-semibold text-slate-900"><Clock size={13} />Conversation</p><p className="mt-1">Started {new Date(selected.createdAt).toLocaleString('en-US')}</p></div>{admin && selected.status !== 'resolved' && <label className="block text-xs font-semibold text-slate-700">Transfer to<select value={selected.assignedTo || ''} onChange={(event) => event.target.value && runAction(() => supportAPI.transferConversation(selected.id, event.target.value))} disabled={busy} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal"><option value="">Select team member</option>{staff.filter((member) => member.id !== selected.assignedTo).map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label>}</div> : <p className="mt-4 text-sm text-slate-400">Customer context appears here.</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}
