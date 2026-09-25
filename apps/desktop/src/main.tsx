import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { desktopLauncher } from './native/desktopLauncher';
import './index.css';
import 'katex/dist/katex.min.css';

// Automatically check local backend service health on desktop boot
desktopLauncher.ensureBackendRunning();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
