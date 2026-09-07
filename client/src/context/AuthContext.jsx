import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, wsClient } from '../api';

const AuthContext = createContext(null);

//渲染:渲染AuthProvider组件或页面内容
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [behavior, setBehavior] = useState({ visitorIds: [], events: [] });
  const [loading, setLoading] = useState(true);

  // 页面加载时检查本地存储的登录状态
  useEffect(() => {
              //执行组件副作用逻辑

    const saved = localStorage.getItem('mall_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.token) {
          setUser(parsed);
          // 验证 token 是否仍然有效
          authAPI.getMe().then(({ user: userData, behavior: mergedBehavior }) => {
                                 //处理异步请求成功结果

            setUser({ ...userData, token: parsed.token });
            setBehavior(mergedBehavior);
          }).catch(() => {
                     //处理异步请求异常

            // token 失效，清除登录状态
            localStorage.removeItem('mall_user');
            wsClient.setToken(null);
            setUser(null);
          });
        } else {
          setUser(parsed);
        }
      } catch (e) {
        localStorage.removeItem('mall_user');
      }
    }
    setLoading(false);
  }, []);

  // 在线角色变更后立即刷新当前账号和Token
  useEffect(() => {
    return wsClient.on('auth.role_updated', ({ user: updatedUser, token }) => {
      if (!updatedUser || !token) return;
      const userData = { ...updatedUser, token };
      setUser(userData);
      localStorage.setItem('mall_user', JSON.stringify(userData));
      wsClient.setToken(token);
    });
  }, []);

  // 登录函数
  const login = async (userName, password) => {
                  //处理回调函数逻辑

    const res = await authAPI.login(userName, password);
    const userData = { ...res.user, token: res.token };
    setUser(userData);
    setBehavior(res.behavior);
    localStorage.setItem('mall_user', JSON.stringify(userData));
    wsClient.setToken(res.token);
    return userData;
  };

  // 注册函数
  const register = async (userName, password, name, quoteReference = '') => {
                     //处理回调函数逻辑

    const res = await authAPI.register(userName, password, name, quoteReference);
    const userData = { ...res.user, token: res.token };
    setUser(userData);
    setBehavior(res.behavior);
    localStorage.setItem('mall_user', JSON.stringify(userData));
    wsClient.setToken(res.token);
    return userData;
  };

  // 登出函数
  const logout = () => {
                   //处理回调函数逻辑

    setUser(null);
    setBehavior({ visitorIds: [], events: [] });
    localStorage.removeItem('mall_user');
    wsClient.disconnect();
  };

  // 检查是否为管理员
  const isAdmin = () => {
                    //处理回调函数逻辑
                    return user?.role === 'admin';
                  };

  const isSeller = () => user?.role === 'seller' || user?.role === 'salesperson';

  const value = {
    user,
    behavior,
    loading,
    login,
    register,
    logout,
    isAdmin,
    isSeller,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

//执行useAuth函数逻辑
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
