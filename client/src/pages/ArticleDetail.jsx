import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock3, UserRound } from 'lucide-react';
import NotFound from './NotFound';

//渲染:格式化文章详情发布日期
function formatArticleDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

//渲染:将纯文本文章内容整理为段落
function buildParagraphs(content = '') {
  return content.split(/\n\s*\n/).map((paragraph) => {
    //渲染:清理文章正文段落
    return paragraph.trim();
  }).filter(Boolean);
}

//渲染:渲染ArticleDetail组件或页面内容
export default function ArticleDetail({ initialArticles = [] }) {
  const { slug } = useParams();
  const initialArticle = initialArticles.find((item) => {
    //查找当前URL对应的已发布文章
    return item.slug === slug;
  });
  const [article, setArticle] = useState(initialArticle);
  const [loading, setLoading] = useState(!initialArticle);

  useEffect(() => {
    //在客户端同步当前URL对应的最新文章内容
    let active = true;

    //请求公开文章详情接口
    async function loadPublishedArticle() {
      try {
        const response = await fetch(`/api/articles/${encodeURIComponent(slug)}`);
        if (!response.ok) throw new Error('Published article not found');
        const result = await response.json();
        if (active) setArticle(result.data);
      } catch (error) {
        if (active && !initialArticle) setArticle(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPublishedArticle();
    return () => {
      //停止已卸载文章页面的数据更新
      active = false;
    };
  }, [slug, initialArticle]);

  useEffect(() => {
    if (article) document.title = `${article.title} | Curva Fabric`;
  }, [article]);

  if (loading) return <div className="min-h-screen pt-28 text-center text-slate-500">Loading article…</div>;
  if (!article) return <NotFound />;

  const sections = Array.isArray(article.sections) ? article.sections : [];
  const paragraphs = sections.length === 0 ? buildParagraphs(article.content) : [];

  return (
    <div className="min-h-screen pt-24 bg-slate-50">
      <article>
        <header className="bg-slate-950 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <p className="text-orange-300 uppercase tracking-wider font-semibold text-sm mb-5">Fabric Buyer Resource</p>
            <h1 className="font-heading text-4xl md:text-6xl font-bold leading-tight mb-6">{article.title}</h1>
            <p className="text-lg text-slate-300 leading-relaxed mb-6">{article.intro || article.summary}</p>
            <div className="flex flex-wrap justify-center gap-5 text-sm text-slate-400">
              <span className="flex items-center gap-2"><CalendarDays size={16} />{formatArticleDate(article.publishedAt || article.createdAt)}</span>
              <span className="flex items-center gap-2"><Clock3 size={16} />{article.readTime}</span>
              <span className="flex items-center gap-2"><UserRound size={16} />{article.authorName || 'Curva Fabric Journal'}</span>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <img src={article.image || '/fabric/hero-denim-mill.png'} alt={article.title} className="w-full aspect-[16/9] object-cover rounded-3xl border border-slate-200 mb-12" width="960" height="540" />
          <div className="space-y-10">
            {sections.map(([title, body]) => {
              //渲染:渲染结构化文章章节
              return <section key={title}><h2 className="font-heading text-3xl font-bold text-slate-900 mb-4">{title}</h2><p className="text-lg text-slate-600 leading-8">{body}</p></section>;
            })}
            {paragraphs.map((paragraph, index) => {
              //渲染:渲染后台录入的纯文本文章段落
              return <p key={`${article.id}-paragraph-${index}`} className="text-lg text-slate-600 leading-8">{paragraph}</p>;
            })}
          </div>
          <aside className="mt-14 bg-white border border-slate-200 rounded-3xl p-8">
            <h2 className="font-heading text-2xl font-bold text-slate-900 mb-3">Planning a denim fabric order?</h2>
            <p className="text-slate-600 mb-6">Share your end use, target composition and weight, color, performance needs, order meters and delivery window.</p>
            <Link to="/contact" className="inline-flex items-center gap-2 text-primary font-semibold">Request swatches &amp; quote <ArrowRight size={18} /></Link>
          </aside>
        </div>
      </article>
    </div>
  );
}
