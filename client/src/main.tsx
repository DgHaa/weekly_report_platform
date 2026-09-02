import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth';
import { DialogProvider } from './components/Dialog';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <DialogProvider>
      <App />
    </DialogProvider>
  </AuthProvider>
);
