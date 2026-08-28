import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3,
  BriefcaseBusiness, Ruler, Search, ShoppingBag, Tag
} from 'lucide-react';

const categories = [
  { id: 'all', label: 'All fabric resources', icon: BookOpen },
  { id: 'buying', label: 'Fabric Selection', icon: ShoppingBag },
  { id: 'technical', label: 'Technical Guide', icon: Ruler },
  { id: 'quality', label: 'Quality & Bulk', icon: BriefcaseBusiness },
];

const categoryById = Object.fromEntries(categories.map((category) => {
  //渲染:生成文章分类索引
  return [category.id, category];
}));

//渲染:格式化文章发布日期
function formatArticleDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

//渲染:渲染NewsBlog组件或页面内容
export default function NewsBlog({ initialArticles = [] }) {
  const [articles, setArticles] = useState(initialArticles);
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    //同步前台最新的已发布文章数据
    let active = true;

    //请求公开文章接口并更新Blog列表
    async function loadPublishedArticles() {
      try {
        const response = await fetch('/api/articles');
        if (!response.ok) throw new Error('Unable to load published articles');
        const result = await response.json();
        if (active && Array.isArray(result.data?.list)) setArticles(result.data.list);
      } catch (error) {
        console.warn('Published article refresh failed:', error);
      }
    }

    loadPublishedArticles();
    return () => {
      //停止已卸载页面的数据更新
      active = false;
    };
  }, []);

  const filteredArticles = useMemo(() => {
    //根据分类和关键词筛选公开文章
    const search = query.trim().toLowerCase();
    return articles.filter((article) => {
      //筛选符合当前查询条件的文章
      const inCategory = activeCategory === 'all' || article.category === activeCategory;
      const matchesSearch = !search || `${article.title} ${article.summary}`.toLowerCase().includes(search);
      return inCategory && matchesSearch;
    });
  }, [articles, activeCategory, query]);

  const featured = articles.find((article) => {
    //优先选择后台标记的推荐文章
    return article.featured;
  }) || articles[0];

  return (
    <div className="min-h-screen pt-24 bg-slate-50">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="absolute -top-32 right-0 w-[34rem] h-[34rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-orange-400/20 bg-orange-400/10 text-orange-200 text-sm mb-6"><BookOpen size={15} />Fabric Buyer Resources</div>
            <h1 className="font-heading text-4xl md:text-6xl font-bold leading-tight mb-5">Choose denim fabric<br />with more confidence.</h1>
            <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">Practical guidance for fabric buyers covering weight, weave, stretch, wash development, testing and bulk order preparation.</p>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {featured && (
          <section className="grid lg:grid-cols-[1.3fr_.7fr] gap-8 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm mb-14">
            <div className="relative min-h-[320px] overflow-hidden">
              <img src={featured.image || '/fabric/hero-denim-mill.png'} alt={featured.title} className="absolute inset-0 w-full h-full object-cover" width="900" height="560" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
            <div className="p-8 md:p-10 flex flex-col justify-center">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-4">Editor&apos;s pick</span>
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-slate-900 leading-tight mb-4">{featured.title}</h2>
              <p className="text-slate-600 leading-relaxed mb-6">{featured.summary}</p>
              <div className="flex items-center gap-4 text-sm text-slate-400 mb-7">
                <span className="flex items-center gap-1.5"><CalendarDays size={15} />{formatArticleDate(featured.publishedAt || featured.createdAt)}</span>
                <span className="flex items-center gap-1.5"><Clock3 size={15} />{featured.readTime}</span>
              </div>
              <Link to={`/news-blog/${featured.slug}`} className="inline-flex items-center gap-2 text-primary font-semibold self-start hover:gap-3 transition-all">Read the guide <ArrowRight size={18} /></Link>
            </div>
          </section>
        )}

        <section aria-labelledby="latest-insights">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div><p className="text-primary font-semibold text-sm uppercase tracking-wider mb-2">Fabric knowledge library</p><h2 id="latest-insights" className="font-heading text-3xl font-bold text-slate-900">Latest fabric insights</h2></div>
            <label className="relative block w-full lg:w-80">
              <span className="sr-only">Search articles</span><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => {
                //处理页面文章搜索事件
                return setQuery(event.target.value);
              }} placeholder="Search the knowledge center" className="w-full rounded-xl py-3 pl-11 pr-4 text-sm" />
            </label>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-3 mb-7" aria-label="Article categories">
            {categories.map(({ id, label, icon: Icon }) => {
              //渲染:渲染文章分类按钮
              return (
                <button key={id} type="button" onClick={() => {
                  //处理文章分类切换事件
                  return setActiveCategory(id);
                }} className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${activeCategory === id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary'}`}><Icon size={16} />{label}</button>
              );
            })}
          </div>

          {filteredArticles.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article) => {
                //渲染:渲染已发布文章卡片
                const category = categoryById[article.category] || categoryById.all;
                return (
                  <article key={article.id} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/70 transition-all duration-300">
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                      <img src={article.image || '/fabric/hero-denim-mill.png'} alt={article.title} loading="lazy" width="640" height="400" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 text-xs font-semibold text-slate-700 shadow-sm"><Tag size={12} className="text-primary" />{category.label}</span>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-3 text-xs text-slate-400 mb-3"><span>{formatArticleDate(article.publishedAt || article.createdAt)}</span><span className="w-1 h-1 rounded-full bg-slate-300" /><span>{article.readTime}</span></div>
                      <h3 className="font-heading text-xl font-semibold text-slate-900 leading-snug mb-3 group-hover:text-primary transition-colors">{article.title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-5">{article.summary}</p>
                      <Link to={`/news-blog/${article.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 group-hover:text-primary transition-colors">Read article <ArrowRight size={16} /></Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl"><Search size={32} className="mx-auto text-slate-300 mb-3" /><h3 className="font-semibold text-slate-800 mb-1">No matching articles</h3><p className="text-sm text-slate-500">Try another keyword or category.</p></div>
          )}
        </section>

        <section className="mt-16 rounded-3xl bg-gradient-to-br from-orange-600 to-amber-500 p-8 md:p-12 text-white flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-orange-100 text-sm font-medium mb-3"><CheckCircle2 size={17} />Preparing a fabric inquiry?</div><h2 className="font-heading text-3xl font-bold mb-3">Review the questions fabric buyers ask most.</h2><p className="text-orange-50/90">MOQ, swatches, technical data, custom development, testing, production, QC and shipping.</p></div>
          <Link to="/faq" className="shrink-0 inline-flex items-center justify-center gap-2 bg-white text-orange-700 px-6 py-3.5 rounded-xl font-semibold hover:bg-orange-50 transition-colors">Browse FAQ <ArrowRight size={18} /></Link>
        </section>
      </main>
    </div>
  );
}
