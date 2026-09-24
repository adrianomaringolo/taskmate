import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root não existe no index.html');

// index.html is sending a first-time visitor to the product page. Booting the
// app in the meantime would write preferences and count this as a visit.
if (!window.__taskmateRedirecting) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
