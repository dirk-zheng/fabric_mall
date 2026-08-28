import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { defaultSiteUrl, getSeoForPath, getStructuredData } from '../seo';
import { useStore } from '../context/StoreContext';

//seo:处理upsertMeta相关逻辑
function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => {
                                       //seo:处理SEO相关回调
                                       return element.setAttribute(name, value);
                                     });
}

//seo:处理upsertCanonical相关逻辑
function upsertCanonical(url) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!url) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', url);
}

//seo:处理SEOManager相关逻辑
export default function SEOManager({ faqs = [], articles = [] }) {
  const { pathname } = useLocation();
  const { state } = useStore();
  const [seoArticles, setSeoArticles] = useState(articles);

  useEffect(() => {
    if (articles.length) {
      setSeoArticles(articles);
      return;
    }
    let active = true;
    fetch('/api/articles')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load SEO articles')))
      .then((result) => {
        if (active && Array.isArray(result.data?.list)) setSeoArticles(result.data.list);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [articles]);

  useEffect(() => {
              //seo:处理SEO相关回调

    const seo = getSeoForPath(pathname, state.products, seoArticles);
    const siteUrl = (import.meta.env.VITE_SITE_URL || defaultSiteUrl).replace(/\/$/, '');
    const canonicalUrl = seo.canonical ? `${siteUrl}${seo.canonical === '/' ? '/' : seo.canonical}` : null;
    const imageUrl = `${siteUrl}${seo.image}`;

    document.title = seo.title;
    upsertMeta('meta[name="description"]', { name: 'description', content: seo.description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: seo.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: seo.description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: seo.type });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Curva Fabric' });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
    upsertCanonical(canonicalUrl);
    if (canonicalUrl) {
      upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    } else {
      document.head.querySelector('meta[property="og:url"]')?.remove();
    }
    let structuredData = document.head.querySelector('script[data-seo-structured-data]');
    if (!structuredData) {
      structuredData = document.createElement('script');
      structuredData.type = 'application/ld+json';
      structuredData.dataset.seoStructuredData = 'true';
      document.head.appendChild(structuredData);
    }
    structuredData.textContent = JSON.stringify(getStructuredData(seo, siteUrl, faqs));
  }, [pathname, state.products, faqs, seoArticles]);

  return null;
}
