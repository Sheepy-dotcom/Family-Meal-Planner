import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles.css';
import { hydrateStorage } from '../store/storage.js';

/**
 * Storage is read once before the first render, so every component can keep
 * reading it synchronously. A few kilobytes; imperceptible on device.
 */
hydrateStorage().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
