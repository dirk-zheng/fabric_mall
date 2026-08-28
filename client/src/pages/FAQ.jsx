import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FAQ({ initialFaqs = [] }) {
  const [items, setItems] = useState(initialFaqs);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(initialFaqs[0]?.id || null);
  const [loading, setLoading] = useState(initialFaqs.length === 0);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadPublishedFaqs() {
      try {
        const response = await fetch('/api/faqs');
        if (!response.ok) throw new Error('Unable to load published FAQs');
        const result = await response.json();
        const list = Array.isArray(result.data?.list) ? result.data.list : [];
        if (!active) return;
        setItems(list);
        setOpen((current) => current || list[0]?.id || null);
        setLoadError('');
      } catch (error) {
        if (active && initialFaqs.length === 0) setLoadError('FAQ content is temporarily unavailable. Please contact our wholesale team for help.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadPublishedFaqs();
    return () => { active = false; };
  }, [initialFaqs.length]);

  const faqs = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter((faq) => !search || `${faq.question} ${faq.answer} ${faq.category}`.toLowerCase().includes(search));
  }, [items, query]);

  return (
    <div className="min-h-screen bg-[#fbf8f2] pt-24">
      <section className="bg-[#dfe6df] px-5 py-16 text-center">
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[#a84d33]">Wholesale buyer FAQ</p>
        <h1 className="mt-3 font-heading text-5xl font-bold text-[#17251f]">Plan your order with clarity.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-[#657068]">Answers for fabric buyers about MOQ, swatches, technical data, custom development, testing, production and shipment.</p>
        <label className="relative mx-auto mt-7 block max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#657068]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search MOQ, pricing, samples or production" className="w-full rounded-full border-0 bg-white py-4 pl-12 pr-5 shadow-sm" />
        </label>
      </section>
      <main className="mx-auto max-w-3xl px-5 py-14">
        {loading && <p className="py-20 text-center text-[#657068]">Loading buyer answers…</p>}
        {!loading && loadError && <p className="rounded-2xl bg-red-50 px-5 py-4 text-center text-red-700">{loadError}</p>}
        {!loading && !loadError && faqs.map((faq) => (
          <article key={faq.id} className="border-b border-[#17251f]/10">
            <button type="button" aria-expanded={open === faq.id} onClick={() => setOpen(open === faq.id ? null : faq.id)} className="flex w-full items-center justify-between gap-5 py-6 text-left">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#a84d33]">{faq.category}</p>
                <h2 className="mt-1 text-lg font-semibold text-[#17251f]">{faq.question}</h2>
              </div>
              <ChevronDown className={`shrink-0 transition ${open === faq.id ? 'rotate-180' : ''}`} />
            </button>
            {open === faq.id && <p className="pb-6 leading-7 text-[#5d6962]">{faq.answer}</p>}
          </article>
        ))}
        {!loading && !loadError && !faqs.length && <p className="py-20 text-center text-[#657068]">No answers match that search.</p>}
        <section className="mt-12 rounded-3xl bg-[#17251f] p-8 text-center text-white">
          <h2 className="font-heading text-2xl font-bold">Have a specific buying brief?</h2>
          <p className="mt-2 text-sm text-white/60">Send your end use, target composition and weight, order meters and delivery window.</p>
          <Link to="/contact" className="mt-5 inline-block rounded-full bg-white px-6 py-3 font-semibold text-[#17251f]">Ask the wholesale team</Link>
        </section>
      </main>
    </div>
  );
}
