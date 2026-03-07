import React from 'react';
import ReactDOM from 'react-dom/client';
import { BLOCK_ALERT_TEXT } from '@/src/constants/text';
import './style.css';

function triggerBlockAlert(): void {
  alert(BLOCK_ALERT_TEXT);
}

triggerBlockAlert();

function App() {
  return (
    <main className="blocked-root">
      <h1>Blocked for today</h1>
      <p>{BLOCK_ALERT_TEXT}</p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
