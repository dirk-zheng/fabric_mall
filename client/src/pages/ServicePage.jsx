import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { servicePages } from '../data/seoContent';
import NotFound from './NotFound';

//渲染:渲染ServicePage组件或页面内容
export default function ServicePage() {
  const { slug } = useParams();
  const service = servicePages[slug];
  if (!service) return <NotFound />;

  return (
    <div className="min-h-screen pt-24 bg-slate-50">
      <header className="bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-[1.1fr_.9fr] gap-12 items-center">
          <div>
            <p className="text-orange-300 font-semibold uppercase tracking-wider text-sm mb-4">{service.eyebrow}</p>
            <h1 className="font-heading text-4xl md:text-6xl font-bold leading-tight mb-6">{service.title}</h1>
            <p className="text-lg text-slate-300 leading-relaxed">{service.intro}</p>
          </div>
          <img src={service.image} alt="Curva Fabric mill service" className="w-full aspect-[4/3] object-cover rounded-3xl border border-white/10" width="800" height="600" />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-6">
          {service.sections.map(([title, body], index) => {
            //渲染:渲染列表内容
            return (
<section key={title} className="bg-white rounded-2xl border border-slate-200 p-7 md:p-9 flex gap-5">
              <CheckCircle2 className="text-primary shrink-0 mt-1" size={24} />
              <div><p className="text-sm font-semibold text-primary mb-2">0{index + 1}</p><h2 className="font-heading text-2xl font-bold text-slate-900 mb-3">{title}</h2><p className="text-slate-600 leading-relaxed">{body}</p></div>
            </section>
            );
          })}
        </div>
        <section className="mt-12 rounded-3xl bg-gradient-to-r from-orange-600 to-amber-500 text-white p-8 md:p-10 flex flex-col md:flex-row gap-6 md:items-center justify-between">
          <div><h2 className="font-heading text-3xl font-bold mb-2">Discuss your fabric brief</h2><p className="text-orange-50">Share your end use, composition, weight, stretch, color, meters and delivery window.</p></div>
          <Link to="/contact" className="shrink-0 inline-flex items-center gap-2 bg-white text-orange-700 px-6 py-3.5 rounded-xl font-semibold">Request swatches <ArrowRight size={18} /></Link>
        </section>
      </main>
    </div>
  );
}
