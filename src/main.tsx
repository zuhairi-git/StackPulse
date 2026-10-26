import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { IconStyleProvider } from './design-system/IconStyle';
import './style.css';
import { loadSession } from './account';
void loadSession().then(() => createRoot(document.getElementById('root')!).render(<React.StrictMode><IconStyleProvider><App /></IconStyleProvider></React.StrictMode>));
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => { window.dispatchEvent(new Event('stackpulse-offline-unavailable')); }); });
}
