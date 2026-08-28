import { useEffect, useRef } from 'react';
import { FileText, X } from 'lucide-react';
import { QuoteForm } from '../pages/Contact';

export default function QuoteModal({ product = '', onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="quote-modal-title">
      <button type="button" aria-label="Close quote form" onClick={onClose} className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-6 border-b border-slate-200 bg-slate-950 px-6 py-5 text-white md:px-8">
          <div className="flex gap-4">
            <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
              <FileText size={22} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">No account required</p>
              <h2 id="quote-modal-title" className="font-heading text-2xl font-bold">Request line sheet &amp; wholesale quote</h2>
              <p className="mt-1 text-sm text-slate-300">Share your retail profile, styles, size range, quantity and delivery window.</p>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close" className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10 hover:text-white">
            <X size={22} />
          </button>
        </header>
        <div className="overflow-y-auto p-6 md:p-8">
          <QuoteForm initialProduct={product} compact />
        </div>
      </div>
    </div>
  );
}
