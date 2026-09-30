import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { assertNoClientSecrets } from '@/lib/env';
import './styles/index.css';

// Fails loudly in development if a server-only secret has been given a VITE_
// prefix and would therefore be compiled into the browser bundle.
assertNoClientSecrets();

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
