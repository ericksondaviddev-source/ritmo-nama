export function themeToggleMarkup() {
  return `
    <button
      type="button"
      data-theme-toggle
      aria-label="Cambiar a tema claro"
      class="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm transition-colors hover:bg-zinc-800"
    >
      <span aria-hidden="true" data-theme-icon>☀️</span>
    </button>`;
}

export function wireThemeToggle(root) {
  const btn = root.querySelector('[data-theme-toggle]');
  if (!btn) return null;
  const icon = btn.querySelector('[data-theme-icon]');

  const sync = () => {
    const solar = document.documentElement.dataset.theme === 'solar';
    if (icon) icon.textContent = solar ? '🌙' : '☀️';
    btn.setAttribute('aria-label', solar ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
  };
  sync();

  btn.addEventListener('click', () => {
    const solar = document.documentElement.dataset.theme !== 'solar';
    document.documentElement.dataset.theme = solar ? 'solar' : 'dark';
    try {
      localStorage.setItem('ritmonama-theme', solar ? 'solar' : 'dark');
    } catch {
      /* sin localStorage: el tema no persiste */
    }
    sync();
  });
  return btn;
}
