import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'

// If the normal Vite stylesheet has loaded, remove the tiny auth-page
// fallback shipped in index.html. If it did not load, retain that fallback so
// slow/stale mobile browsers still render a usable sign-up/sign-in form.
requestAnimationFrame(() => {
  const normalStylesLoaded = [...document.styleSheets].some((sheet) =>
    typeof sheet.href === 'string' && /\/assets\/.*\.css(?:$|\?)/.test(sheet.href)
  );
  if (normalStylesLoaded) {
    document.getElementById('critical-auth-fallback')?.remove();
    document.documentElement.removeAttribute('data-critical-auth');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
