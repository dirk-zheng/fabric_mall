import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { QuoteModalProvider, useQuoteModal } from './context/QuoteModalContext';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import Products from './pages/Products';
import About from './pages/About';
import QuoteRequest from './pages/QuoteRequest';
import Admin from './pages/Admin';
import Login from './pages/Login';
import NewsBlog from './pages/NewsBlog';
import FAQ from './pages/FAQ';
import ProductDetail from './pages/ProductDetail';
import ServicePage from './pages/ServicePage';
import ArticleDetail from './pages/ArticleDetail';
import Contact from './pages/Contact';
import SupportWidget from './components/SupportWidget';
import SEOManager from './components/SEOManager';
import NotFound from './pages/NotFound';
import AdminToolRail from './components/AdminToolRail';
import AdminUsers from './pages/AdminUsers';
import AdminArticles from './pages/AdminArticles';
import AdminFaqs from './pages/AdminFaqs';
import SupportInbox from './pages/SupportInbox';
import { RequireAuth, RequireAdmin, RequireStaff } from './components/ProtectedRoute';

function QuoteLinkInterceptor({ children }) {
  const { openQuote } = useQuoteModal();

  const handleClickCapture = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || anchor.target === '_blank') return;

    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== '/contact') return;

    event.preventDefault();
    openQuote(url.searchParams.get('product') || '');
  };

  return <div onClickCapture={handleClickCapture}>{children}</div>;
}

//渲染:渲染AppContent组件或页面内容
export function AppContent({ initialProducts = [], initialFaqs = [], initialArticles = [] }) {
  return (
    <AuthProvider>
      <QuoteModalProvider>
        <StoreProvider initialProducts={initialProducts}>
          <QuoteLinkInterceptor>
          <div className="min-h-screen flex flex-col">
            <SEOManager faqs={initialFaqs} articles={initialArticles} />
            <Header />
            <AdminToolRail />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:slug" element={<ProductDetail />} />
                <Route path="/about" element={<About />} />
                <Route path="/news-blog/" element={<NewsBlog initialArticles={initialArticles} />} />
                <Route path="/news-blog/:slug" element={<ArticleDetail initialArticles={initialArticles} />} />
                <Route path="/services/:slug" element={<ServicePage />} />
                <Route path="/faq" element={<FAQ initialFaqs={initialFaqs} />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/login" element={<Login />} />
                <Route
                  path="/quote"
                  element={
                    <RequireAuth>
                      <QuoteRequest />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAdmin>
                      <Admin />
                    </RequireAdmin>
                  }
                />
                <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
                <Route path="/admin/roles" element={<RequireAdmin><AdminUsers manageRoles /></RequireAdmin>} />
                <Route path="/admin/articles" element={<RequireAdmin><AdminArticles /></RequireAdmin>} />
                <Route path="/admin/faqs" element={<RequireAdmin><AdminFaqs /></RequireAdmin>} />
                <Route path="/support/inbox" element={<RequireStaff><SupportInbox /></RequireStaff>} />
                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />

            {/* Floating Support FAB + Chat Panel */}
            <SupportWidget />
          </div>
          </QuoteLinkInterceptor>
        </StoreProvider>
      </QuoteModalProvider>
    </AuthProvider>
  );
}

//渲染:渲染App组件或页面内容
function App({ initialProducts = [], initialFaqs = [], initialArticles = [] }) {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent initialProducts={initialProducts} initialFaqs={initialFaqs} initialArticles={initialArticles} />
    </BrowserRouter>
  );
}

export default App;
