import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import wsClient from '../api/ws';
import FloatingSupport from './FloatingSupport';

const CLICKED_KEY = 'curva_fabric_support_badge_seen_v1';

//渲染:渲染SupportWidget组件或页面内容
export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDot, setShowDot] = useState(false);
  const [unreadSenders, setUnreadSenders] = useState(new Set());
  const { user } = useAuth();
  const isOpenRef = useRef(false);

  isOpenRef.current = isOpen; // always current

  const isStaff = user?.role === 'admin' || ['seller', 'salesperson'].includes(user?.role);
  const isCustomer = !user || !isStaff;

  // Customer: keep the first-visit prompt visible until the widget is opened.
  useEffect(() => {
              //执行组件副作用逻辑

    if (isCustomer) setShowDot(!localStorage.getItem(CLICKED_KEY));
  }, [isCustomer, user?.account]); // re-check when the visitor or role changes

  // Sales: listen for incoming IM messages
  useEffect(() => {
              //执行组件副作用逻辑

    if (!isStaff) return;

    const unsubMessage = wsClient.on('support.message.created', (data) => {
      if (data.senderType !== 'customer') return;
                                              //处理回调函数逻辑

      if (!isOpenRef.current) {
        setShowDot(true);
        setUnreadSenders(prev => {
                           //处理回调函数逻辑

          const next = new Set(prev);
          next.add(data.senderAccount);
          return next;
        });
      }
    });

    const unsubQueue = wsClient.on('support.conversation.updated', (data) => {
      if (data.status === 'waiting_human' && !isOpenRef.current) setShowDot(true);
    });

    return () => { unsubMessage(); unsubQueue(); };
  }, [isStaff]);

  const handleToggle = useCallback(() => {
                                     //创建并缓存回调函数

    const opening = !isOpen;
    setIsOpen(opening);

    if (opening) {
      // Clear dot for customer
      if (isCustomer) {
        localStorage.setItem(CLICKED_KEY, 'true');
      }
      setShowDot(false);
      setUnreadSenders(new Set());
    }
  }, [isOpen, isCustomer]);

  const handleClose = useCallback(() => {
                                    //创建并缓存回调函数

    setIsOpen(false);
    // Don't re-show the customer dot after close (already clicked)
    // Sales dot may re-appear on next incoming message
  }, []);

  const unreadCount = unreadSenders.size;

  if (isStaff) {
    return (
      <Link to="/support/inbox" className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/30 transition-transform hover:scale-110" title="Wholesale buyer inquiry inbox" aria-label="Wholesale buyer inquiry inbox">
        {showDot && <span className="absolute -right-1 -top-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full border-[3px] border-white bg-red-500 px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount || ''}</span>}
        <MessageCircle size={26} />
      </Link>
    );
  }

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={handleToggle}
        className={`fixed bottom-6 right-6 h-[178px] w-[178px] rounded-full bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/30 flex items-center justify-center z-50 transition-all hover:scale-110 hover:shadow-xl hover:shadow-primary/40 ${
          isOpen ? 'rotate-90' : ''
        }`}
        title={isStaff ? 'Buyer Messages' : 'Wholesale Buyer Support'}
        aria-label={isOpen ? 'Close wholesale buyer support' : 'Open wholesale buyer support, 1 new prompt'}
      >
        {/* Big Red Dot */}
        {showDot && (
          <span className="absolute right-3 top-3 flex h-8 min-w-8 items-center justify-center rounded-full border-[3px] border-white bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-900/25 ring-1 ring-red-700/15 transition-transform duration-200">
            {isStaff && unreadCount > 0 ? (
              <span className="px-1 text-[11px] font-bold leading-none text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : <span className="px-1 text-xs font-bold leading-none text-white">1</span>}
          </span>
        )}

        {isOpen ? (
          <svg className="h-14 w-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <MessageCircle size={64} className="text-white" />
        )}
      </button>

      {/* Chat Panel */}
      <FloatingSupport isOpen={isOpen} onClose={handleClose} />
    </>
  );
}
