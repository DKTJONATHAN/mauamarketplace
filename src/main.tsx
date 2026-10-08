import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/figtree';
import './styles/app.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SetupNeeded } from './components/SetupNeeded';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { env } from './lib/env';

if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' });
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      {env.configured ? (
        <QueryClientProvider client={queryClient}>
          <HashRouter>
            <ToastProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ToastProvider>
          </HashRouter>
        </QueryClientProvider>
      ) : (
        <SetupNeeded />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
