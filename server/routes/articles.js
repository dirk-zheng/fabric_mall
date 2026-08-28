const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const ARTICLES_FILE = path.join(__dirname, '..', 'data', 'articles.json');

//读取并整理允许公开展示的文章数据
function readPublishedArticles() {
  if (!fs.existsSync(ARTICLES_FILE)) return [];
  const data = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf-8'));
  if (!Array.isArray(data)) return [];
  return data
    .filter((article) => {
      //筛选允许前台公开展示的文章记录
      return article.status === 'published';
    })
    .sort((a, b) => {
      //按照发布时间倒序排列公开文章记录
      return new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0);
    });
}

//返回前台允许展示的已发布文章列表
router.get('/', (req, res) => {
  try {
    const list = readPublishedArticles();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ code: 200, data: { list, total: list.length } });
  } catch (error) {
    console.error('Read published articles failed:', error);
    res.status(500).json({ code: 500, message: 'Unable to load published articles' });
  }
});

//返回指定URL标识对应的已发布文章
router.get('/:slug', (req, res) => {
  try {
    const article = readPublishedArticles().find((item) => {
      //查找URL标识完全匹配的公开文章
      return item.slug === req.params.slug;
    });
    if (!article) return res.status(404).json({ code: 404, message: 'Published article not found' });
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json({ code: 200, data: article });
  } catch (error) {
    console.error('Read published article failed:', error);
    return res.status(500).json({ code: 500, message: 'Unable to load the published article' });
  }
});

module.exports = router;
