import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { PlatformProvider } from './state/PlatformContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PlatformProvider>
        <App />
      </PlatformProvider>
    </BrowserRouter>
  </StrictMode>,
);
