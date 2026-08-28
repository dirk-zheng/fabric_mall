import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, User, ArrowRight, Loader2, Sparkles, Shield, Users, Globe } from 'lucide-react';

//渲染:渲染Login组件或页面内容
export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
                         //处理回调函数逻辑

    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password, name);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Shield, text: 'Save fabric RFQ selections' },
    { icon: Users, text: 'Connect with the sales team' },
    { icon: Globe, text: 'For qualified global fabric buyers' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center px-4 pb-8 pt-32">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex flex-col items-center lg:items-start max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-xl shadow-primary/20">
              <span className="text-white font-heading font-bold text-3xl">C</span>
            </div>
            <div>
              <h1 className="font-heading text-3xl font-bold text-dark-900">Curva Fabric</h1>
              <p className="text-dark-500">B2B Denim Fabric Supply</p>
            </div>
          </div>

          <h2 className="text-4xl font-heading font-bold text-dark-900 mb-4 leading-tight">
            Welcome to<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              Curva Fabric
            </span>
          </h2>

          <p className="text-dark-500 mb-8">
            Sign in to build multi-quality RFQs, keep technical requirements organized and continue sourcing conversations with our fabric team.
          </p>

          <div className="space-y-4">
            {features.map((feature, index) => {
                            //渲染:渲染列表内容

              const Icon = feature.icon;
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon size={20} className="text-primary" />
                  </div>
                  <span className="text-dark-600">{feature.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl shadow-primary/10 border border-dark-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-secondary p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
                <Sparkles size={32} className="text-white" />
              </div>
              <h3 className="font-heading text-2xl font-bold text-white">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                {isLogin ? 'Sign in to your account' : 'Register for distributor quote access'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm animate-shake">
                  {error}
                </div>
              )}

              {/* Name (Register only) */}
              {!isLogin && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-dark-700">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                                  //处理页面交互事件
                                  return setName(e.target.value);
                                }}
                      placeholder="Enter your name"
                      className="w-full px-4 py-3 pl-11 rounded-xl border border-dark-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white"
                    />
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
                  </div>
                </div>
              )}

              {/* Username */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-dark-700">
                  Username or email
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                                //处理页面交互事件
                                return setUsername(e.target.value);
                              }}
                    placeholder="Enter username or email"
                    required
                    className="w-full px-4 py-3 pl-11 rounded-xl border border-dark-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white"
                  />
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-dark-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                                //处理页面交互事件
                                return setPassword(e.target.value);
                              }}
                    placeholder="Enter password"
                    required
                    minLength={isLogin ? undefined : 6}
                    className="w-full px-4 py-3 pl-11 pr-11 rounded-xl border border-dark-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white"
                  />
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" />
                  <button
                    type="button"
                    onClick={() => {
                               //处理页面交互事件
                               return setShowPassword(!showPassword);
                             }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {!isLogin && <p className="text-xs text-dark-500">Use at least 6 characters.</p>}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mt-6"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Register'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              {/* Toggle Login/Register */}
              <p className="text-center text-sm text-dark-500 mt-4">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <button
                  type="button"
                  onClick={() => {
                             //处理页面交互事件

                    setIsLogin(!isLogin);
                    setError('');
                  }}
                  className="text-primary font-medium hover:underline ml-1"
                >
                  {isLogin ? 'Register Now' : 'Sign In'}
                </button>
              </p>

            </form>
          </div>

          {/* Back to Home */}
          <div className="text-center mt-6">
            <Link
              to="/"
              className="text-sm text-dark-500 hover:text-primary transition-colors"
            >
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
