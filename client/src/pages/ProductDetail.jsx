import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ClipboardPlus, Factory, FileCheck2, PackageCheck, Ruler } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { categoryNames } from '../data/products';
import { productSlug } from '../data/seoContent';

export default function ProductDetail(){
  const {slug}=useParams(); const {state,addToRfqAssortment}=useStore(); const {user}=useAuth();
  const [added,setAdded]=useState(false); const [error,setError]=useState('');
  const p=state.products.find(x=>productSlug(x)===slug);
  if(!p)return <div className="min-h-screen pt-40 text-center"><h1 className="text-3xl font-bold">Fabric quality not found</h1><Link to="/products" className="mt-4 inline-block text-[#a84d33]">View all fabrics</Link></div>;
  const specs=Array.isArray(p.specs)?p.specs:[];
  const add=async()=>{setError('');try{await addToRfqAssortment(p);setAdded(true)}catch(err){setError(err.message)}};
  return <div className="min-h-screen bg-[#fbf8f2] pt-24"><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
    <Link to="/products" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[#526158]"><ArrowLeft size={16}/> Back to fabric library</Link>
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16"><div className="overflow-hidden rounded-[2.25rem] bg-[#eee9e0]"><img src={p.image} alt={p.name} className="aspect-[4/3] w-full object-cover"/></div><section className="lg:py-4">
      <p className="text-sm font-bold uppercase tracking-[.2em] text-[#a84d33]">{categoryNames[p.category]} · Mill quality</p><h1 className="mt-3 font-heading text-4xl font-bold text-[#17251f] sm:text-5xl">{p.name}</h1><p className="mt-6 text-lg leading-8 text-[#56635c]">{p.description}</p>
      <div className="mt-7 grid grid-cols-2 gap-3">{[['Typical MOQ',p.moq||'Confirmed by quality'],['Production',p.leadTime||'30–45 days after approval'],['Fabric weight',p.sizes||'Confirmed by quality'],['Mill price','Quoted by volume & terms']].map(([label,value])=><div key={label} className="rounded-2xl bg-white p-4"><span className="text-xs uppercase tracking-wider text-[#657068]">{label}</span><strong className="mt-1 block">{value}</strong></div>)}</div>
      <div className="mt-7"><div className="flex justify-between"><h2 className="font-semibold">Technical data available</h2><Link to="/services/fit-and-size-guide" className="flex items-center gap-1 text-sm font-semibold underline"><Ruler size={15}/> Fabric guide</Link></div><div className="mt-3 flex flex-wrap gap-2">{['Composition','GSM / oz','Usable width','Stretch','Shrinkage','Skew','Colorfastness'].map(s=><span key={s} className="rounded-xl border border-[#17251f]/15 bg-white px-3 py-2 text-sm font-semibold">{s}</span>)}</div><p className="mt-3 text-xs text-[#657068]">Test methods, tolerances and final values are confirmed on the approved quality sheet.</p></div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2"><Link to={`/contact?product=${encodeURIComponent(p.name)}`} className="flex items-center justify-center rounded-full bg-[#17251f] px-5 py-4 font-semibold text-white hover:bg-[#a84d33]">Request swatch &amp; quote</Link>{user?<button onClick={add} disabled={added} className="flex items-center justify-center gap-2 rounded-full border border-[#17251f]/20 px-5 py-4 font-semibold disabled:bg-emerald-50 disabled:text-emerald-700"><ClipboardPlus size={18}/>{added?'Added to RFQ':'Add to fabric RFQ'}</button>:<Link to="/login" state={{from:{pathname:`/products/${slug}`}}} className="flex items-center justify-center gap-2 rounded-full border border-[#17251f]/20 px-5 py-4 font-semibold"><ClipboardPlus size={18}/> Sign in to build RFQ</Link>}</div>{error&&<p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-8"><h2 className="font-heading text-2xl font-bold">Fabric specifications</h2><ul className="mt-4 space-y-3">{specs.map(s=><li key={s} className="flex gap-3 text-[#56635c]"><Check className="mt-1 shrink-0 text-[#a84d33]" size={16}/>{s}</li>)}</ul>{p.applications&&<p className="mt-5 rounded-2xl bg-[#efe8dc] p-5 text-sm leading-6"><strong>End-use note:</strong> {p.applications}</p>}</div>
      <div className="mt-7 grid gap-3 border-y border-[#17251f]/10 py-6 sm:grid-cols-3"><span className="flex items-center gap-2 text-xs"><Factory size={17}/> Mill follow-up</span><span className="flex items-center gap-2 text-xs"><FileCheck2 size={17}/> Approved standard</span><span className="flex items-center gap-2 text-xs"><PackageCheck size={17}/> Roll inspection</span></div>
    </section></div>
  </main></div>;
}
