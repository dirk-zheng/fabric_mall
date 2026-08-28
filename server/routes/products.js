const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const PRODUCTS_FILE = path.join(__dirname, '..', 'data', 'products.json');

//读取商品数据列表
function readProducts() {
  const data = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
  return JSON.parse(data);
}

//将商品数据列表写入本地文件
function writeProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
}

// GET /api/products - List products (search, category filter, sort)
//查询商品列表并支持搜索筛选排序和分页
router.get('/', (req, res) => {
  try {
    const { search, category, sort, page = 1, pageSize = 20 } = req.query;
    let products = readProducts();

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      //根据商品名称和描述筛选搜索结果
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (category && category !== 'all') {
      //根据商品分类筛选列表
      products = products.filter(p => p.category === category);
    }

    // Sort
    if (sort === 'price-asc') {
      //按商品价格升序排列列表
      products.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc') {
      //按商品价格降序排列列表
      products.sort((a, b) => b.price - a.price);
    }

    // Pagination
    const total = products.length;
    const p = parseInt(page);
    const ps = parseInt(pageSize);
    const start = (p - 1) * ps;
    const paged = products.slice(start, start + ps);

    res.json({
      code: 200,
      data: { list: paged, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// GET /api/products/categories - Category statistics
//统计并返回各商品分类的数量
router.get('/categories', (req, res) => {
  try {
    const products = readProducts();
    const categoryMap = {};
    //遍历商品并累计分类数量
    products.forEach(p => {
      categoryMap[p.category] = (categoryMap[p.category] || 0) + 1;
    });
    //将分类统计对象转换为接口数组格式
    const categories = Object.entries(categoryMap).map(([name, count]) => ({ name, count }));
    res.json({ code: 200, data: { total: products.length, categories } });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// GET /api/products/:id - Get single product
//根据商品ID查询单个商品详情
router.get('/:id', (req, res) => {
  try {
    const products = readProducts();
    //根据请求ID查找商品详情
    const product = products.find(p => p.id === req.params.id);

    if (!product) {
      return res.status(404).json({ code: 404, message: 'Product not found' });
    }

    res.json({ code: 200, data: product });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// POST /api/products - Add product (admin only)
//校验管理员提交的数据并新增商品
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, category, image, description, moq, leadTime, applications, specs = [], qc = [] } = req.body;

    // Validation
    const errors = [];
    if (!name || name.length < 2 || name.length > 100) {
      errors.push('Product name must be 2-100 characters');
    }
    if (!category || !['jeans', 'denim-skirts', 'denim-jackets'].includes(category)) {
      errors.push('Please select a valid product category');
    }
    if (!image) {
      errors.push('Please provide a product image URL');
    }
    if (!description) {
      errors.push('Please provide a product description');
    }

    if (errors.length > 0) {
      return res.status(400).json({ code: 400, message: 'Validation failed', errors });
    }

    const products = readProducts();
    const newProduct = {
      id: uuidv4(),
      name: name.trim(),
      category,
      price: 0,
      stock: 0,
      image: image.trim(),
      description: description.trim(),
      moq: String(moq || '').trim(), leadTime: String(leadTime || '').trim(),
      applications: String(applications || '').trim(),
      specs: Array.isArray(specs) ? specs.map(String).filter(Boolean) : [],
      qc: Array.isArray(qc) ? qc.map(String).filter(Boolean) : []
    };

    products.push(newProduct);
    writeProducts(products);

    res.status(201).json({ code: 201, message: 'Product added successfully', data: newProduct });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// PUT /api/products/:id - Update product (admin only)
//校验管理员提交的数据并更新指定商品
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const products = readProducts();
    //查找需要更新的商品索引
    const index = products.findIndex(p => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ code: 404, message: 'Product not found' });
    }

    const { name, category, image, description, moq, leadTime, applications, specs, qc } = req.body;

    // Validation
    const errors = [];
    if (!name || name.length < 2 || name.length > 100) {
      errors.push('Product name must be 2-100 characters');
    }
    if (!category || !['jeans', 'denim-skirts', 'denim-jackets'].includes(category)) {
      errors.push('Please select a valid product category');
    }
    if (!image) {
      errors.push('Please provide a product image URL');
    }
    if (!description) {
      errors.push('Please provide a product description');
    }

    if (errors.length > 0) {
      return res.status(400).json({ code: 400, message: 'Validation failed', errors });
    }

    products[index] = {
      ...products[index],
      name: name.trim(),
      category,
      image: image.trim(),
      description: description.trim(),
      moq: String(moq || '').trim(), leadTime: String(leadTime || '').trim(),
      applications: String(applications || '').trim(),
      specs: Array.isArray(specs) ? specs.map(String).filter(Boolean) : products[index].specs,
      qc: Array.isArray(qc) ? qc.map(String).filter(Boolean) : products[index].qc
    };

    writeProducts(products);

    res.json({ code: 200, message: 'Product updated successfully', data: products[index] });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

// DELETE /api/products/:id - Delete product (admin only)
//删除管理员指定的商品记录
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const products = readProducts();
    //查找需要删除的商品索引
    const index = products.findIndex(p => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ code: 404, message: 'Product not found' });
    }

    const removed = products.splice(index, 1)[0];
    writeProducts(products);

    res.json({ code: 200, message: 'Product deleted successfully', data: removed });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
});

module.exports = router;
