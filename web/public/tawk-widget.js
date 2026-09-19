/*
 * Tawk.to live support widget.
 *
 * This is an external file rather than an inline snippet so the production
 * Content-Security-Policy can stay strict. It is also loaded by AdminJS,
 * which makes the same support chat available to administrators.
 */
window.Tawk_API = window.Tawk_API || {};
window.Tawk_LoadStart = new Date();

(function loadTawkWidget() {
  if (document.querySelector('script[data-ktech-tawk-widget]')) return;

  const script = document.createElement('script');
  const firstScript = document.getElementsByTagName('script')[0];
  script.async = true;
  script.src = 'https://embed.tawk.to/6aae3fec9387e034445258f5/1k2sajdc0';
  script.charset = 'UTF-8';
  script.setAttribute('crossorigin', '*');
  script.setAttribute('data-ktech-tawk-widget', 'true');
  firstScript.parentNode.insertBefore(script, firstScript);
})();
