import { createContext, useCallback, useContext, useState } from 'react';
import QuoteModal from '../components/QuoteModal';

const QuoteModalContext = createContext(null);

export function QuoteModalProvider({ children }) {
  const [request, setRequest] = useState(null);

  const openQuote = useCallback((product = '') => {
    setRequest({ product, key: Date.now() });
  }, []);

  const closeQuote = useCallback(() => setRequest(null), []);

  return (
    <QuoteModalContext.Provider value={{ openQuote, closeQuote }}>
      {children}
      {request && (
        <QuoteModal
          key={request.key}
          product={request.product}
          onClose={closeQuote}
        />
      )}
    </QuoteModalContext.Provider>
  );
}

export function useQuoteModal() {
  const context = useContext(QuoteModalContext);
  if (!context) throw new Error('useQuoteModal must be used within QuoteModalProvider');
  return context;
}

