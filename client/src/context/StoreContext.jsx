import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { productAPI, rfqAssortmentAPI, quoteAPI } from '../api';

const StoreContext = createContext();

const initialState = {
  products: [],
  rfqAssortment: [],
  chatHistory: [],
  loading: true,
};

//执行reducer函数逻辑
function reducer(state, action) {
  switch (action.type) {
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload, loading: false };

    case 'SET_RFQ_ASSORTMENT':
      return { ...state, rfqAssortment: action.payload };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'ADD_MESSAGE':
      return {
        ...state,
        chatHistory: [...state.chatHistory, action.payload]
      };

    case 'CLEAR_CHAT':
      return { ...state, chatHistory: [] };

    default:
      return state;
  }
}

//渲染:渲染StoreProvider组件或页面内容
export function StoreProvider({ children, initialProducts = [] }) {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    products: initialProducts,
    loading: initialProducts.length === 0,
  });
  const { user } = useAuth();

  // 加载商品列表
  const loadProducts = useCallback(async () => {
                                     //创建并缓存回调函数

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const data = await productAPI.getList({ pageSize: 100 });
      dispatch({ type: 'SET_PRODUCTS', payload: data.list });
    } catch (err) {
      console.error('加载商品失败:', err);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // 加载 RFQ 选品清单
  const loadRfqAssortment = useCallback(async () => {
                                      //创建并缓存回调函数

    try {
      const data = await rfqAssortmentAPI.getList();
      dispatch({ type: 'SET_RFQ_ASSORTMENT', payload: data.items });
    } catch (err) {
      console.error('加载 RFQ 选品清单失败:', err);
    }
  }, []);

  // 首次加载商品
  useEffect(() => {
              //执行组件副作用逻辑

    loadProducts();
  }, [loadProducts]);

  // 用户变化时加载/清空 RFQ 选品清单
  useEffect(() => {
              //执行组件副作用逻辑

    if (user?.token) {
      loadRfqAssortment();
    } else {
      dispatch({ type: 'SET_RFQ_ASSORTMENT', payload: [] });
    }
  }, [user, loadRfqAssortment]);

  // ─── RFQ 选品清单与询盘操作 ────────────────

  const addToRfqAssortment = async (product) => {
                           //处理回调函数逻辑

    try {
      await rfqAssortmentAPI.add(product.id, 1);
      await loadRfqAssortment();
    } catch (err) {
      console.error('添加到 RFQ 选品清单失败:', err);
      throw err;
    }
  };

  const removeFromRfqAssortment = async (productId) => {
                                //处理回调函数逻辑

    try {
      await rfqAssortmentAPI.remove(productId);
      await loadRfqAssortment();
    } catch (err) {
      console.error('移除 RFQ 选品失败:', err);
      throw err;
    }
  };

  const updateQuantity = async (productId, quantity) => {
                           //处理回调函数逻辑

    try {
      await rfqAssortmentAPI.updateQuantity(productId, quantity);
      await loadRfqAssortment();
    } catch (err) {
      console.error('更新数量失败:', err);
      throw err;
    }
  };

  const clearRfqAssortment = async () => {
                           //处理回调函数逻辑

    try {
      await rfqAssortmentAPI.clear();
      dispatch({ type: 'SET_RFQ_ASSORTMENT', payload: [] });
    } catch (err) {
      console.error('清空 RFQ 选品清单失败:', err);
      throw err;
    }
  };

  const submitQuote = async (request) => {
                        //处理回调函数逻辑

    const result = await quoteAPI.submit(request);
    dispatch({ type: 'SET_RFQ_ASSORTMENT', payload: [] });
    return result;
  };

  // ─── 商品管理操作 ──────────────────────────

  const addProduct = async (productData) => {
                       //处理回调函数逻辑

    try {
      await productAPI.create(productData);
      await loadProducts();
    } catch (err) {
      console.error('添加商品失败:', err);
      throw err;
    }
  };

  const updateProduct = async (id, productData) => {
                          //处理回调函数逻辑

    try {
      await productAPI.update(id, productData);
      await loadProducts();
    } catch (err) {
      console.error('更新商品失败:', err);
      throw err;
    }
  };

  const deleteProduct = async (productId) => {
                          //处理回调函数逻辑

    try {
      await productAPI.delete(productId);
      await loadProducts();
    } catch (err) {
      console.error('删除商品失败:', err);
      throw err;
    }
  };

  const value = {
    state,
    dispatch,
    loadProducts,
    // RFQ 选品清单与询盘
    addToRfqAssortment,
    removeFromRfqAssortment,
    updateQuantity,
    clearRfqAssortment,
    submitQuote,
    // 商品管理
    addProduct,
    updateProduct,
    deleteProduct,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

//执行useStore函数逻辑
export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
