const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const FAQS_FILE = path.join(__dirname, '..', 'data', 'faqs.json');

//读取并整理允许公开展示的FAQ数据
function readPublishedFaqs() {
  if (!fs.existsSync(FAQS_FILE)) return [];
  const data = JSON.parse(fs.readFileSync(FAQS_FILE, 'utf-8'));
  if (!Array.isArray(data)) return [];
  return data
    .filter((faq) => {
      //筛选允许前台公开展示的FAQ记录
      return faq.status === 'published';
    })
    .sort((a, b) => {
      //按照配置顺序排列公开FAQ记录
      return (Number(a.sortOrder) || 9999) - (Number(b.sortOrder) || 9999);
    });
}

//返回前台允许展示的已发布FAQ列表
router.get('/', (req, res) => {
  try {
    const list = readPublishedFaqs();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ code: 200, data: { list, total: list.length } });
  } catch (error) {
    console.error('Read published FAQs failed:', error);
    res.status(500).json({ code: 500, message: 'Unable to load published FAQs' });
  }
});

module.exports = router;
