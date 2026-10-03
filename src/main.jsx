import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { BootErrorBoundary } from './App.jsx';
import './om_guru_invoice_patch.js';

createRoot(document.getElementById('root')).render(
  <BootErrorBoundary><App /></BootErrorBoundary>
);
