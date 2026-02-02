import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css'
import App from './App.tsx';
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('🔄 有新版本可用，是否立即更新？')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('📦 App 已可離線使用');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);