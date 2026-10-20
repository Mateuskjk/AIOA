/*
 * AIOA support widget — paste on any page (e.g. LexFlow):
 *   <script src="https://SEU-AIOA/widget.js" defer></script>
 * Adds a floating button that opens the AIOA assistant (/embed) in a panel.
 */
(() => {
  if (window.__aioaWidget) return;
  window.__aioaWidget = true;
  const origin = new URL(document.currentScript.src).origin;

  const css = `
    .aioa-btn { position: fixed; right: 24px; bottom: 24px; z-index: 2147483000; width: 60px; height: 60px; border-radius: 50%; border: 0; cursor: pointer;
      background: #f04a20; color: #fff; display: grid; place-items: center; box-shadow: 0 12px 30px rgb(240 74 32 / 45%); transition: transform .2s, box-shadow .2s; }
    .aioa-btn:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 16px 38px rgb(240 74 32 / 55%); }
    .aioa-btn svg { width: 30px; height: 30px; }
    .aioa-panel { position: fixed; right: 24px; bottom: 96px; z-index: 2147483000; width: min(400px, calc(100vw - 32px)); height: min(640px, calc(100vh - 120px));
      border: 1px solid rgb(249 249 249 / 10%); border-radius: 18px; overflow: hidden; background: #0e0e10; box-shadow: 0 24px 70px rgb(0 0 0 / 45%);
      opacity: 0; transform: translateY(12px) scale(.98); pointer-events: none; transition: opacity .2s, transform .2s; }
    .aioa-panel.open { opacity: 1; transform: none; pointer-events: auto; }
    .aioa-panel iframe { width: 100%; height: 100%; border: 0; }
    @media (max-width: 480px) { .aioa-panel { right: 16px; bottom: 88px; } .aioa-btn { right: 16px; bottom: 16px; } }`;
  const logo = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M24 10 A43 43 0 0 0 24 90 A52 52 0 0 1 24 10Z" fill="currentColor"/>
    <circle cx="60" cy="50" r="33" fill="none" stroke="currentColor" stroke-width="11" stroke-dasharray="178 30" transform="rotate(78 60 50)"/>
    <path fill="currentColor" d="M46 80 C33 66 34 40 54 33 C61 31 68 32 72 37 L80 40 L72 42 C62 40 54 49 54 61 C54 69 57 74 63 79 Z"/></svg>`;
  const close = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'aioa-panel';
  const btn = document.createElement('button');
  btn.className = 'aioa-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Abrir suporte AIOA');
  btn.innerHTML = logo;
  document.body.append(panel, btn);

  const toggle = (open = !panel.classList.contains('open')) => {
    // The iframe loads on first open, so the host page doesn't pay for it up front.
    if (open && !panel.firstChild) {
      const frame = document.createElement('iframe');
      frame.src = `${origin}/embed`;
      frame.title = 'Suporte AIOA';
      frame.allow = 'microphone; clipboard-write';
      panel.appendChild(frame);
    }
    panel.classList.toggle('open', open);
    btn.innerHTML = open ? close : logo;
    btn.setAttribute('aria-label', open ? 'Fechar suporte AIOA' : 'Abrir suporte AIOA');
  };
  btn.addEventListener('click', () => toggle());
  window.addEventListener('message', (e) => {
    if (e.origin === origin && e.data === 'aioa:close') toggle(false);
  });
})();
