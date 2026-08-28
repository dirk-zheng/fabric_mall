import { ArrowLeft, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

//渲染:渲染NotFound组件或页面内容
export default function NotFound() {
  return (
    <div className="min-h-screen pt-24 flex items-center justify-center bg-gradient-to-b from-white to-slate-100 px-4">
      <div className="max-w-xl text-center">
        <div className="w-24 h-24 mx-auto mb-7 rounded-3xl bg-white border border-slate-200 shadow-lg flex items-center justify-center">
          <SearchX size={44} className="text-slate-400" />
        </div>
        <p className="font-mono text-primary font-bold tracking-widest mb-3">404</p>
        <h1 className="font-heading text-4xl font-bold text-slate-900 mb-4">Page not found</h1>
        <p className="text-slate-500 leading-relaxed mb-8">The page may have moved, or the address may be incorrect. Return to the latest Curva Fabric library.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:opacity-90 transition-opacity">
          <ArrowLeft size={18} /> Back to Home
        </Link>
      </div>
    </div>
  );
}
