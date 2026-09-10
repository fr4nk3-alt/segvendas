'use strict';

/* Versão 5.9.8 — seletor persistente de tamanho do avatar. */
(() => {
  const mover = document.getElementById('nestorxMover');
  const tip = document.getElementById('seguitoTip');
  if (!mover || !tip || tip.querySelector('.nestorx-size-control')) return;

  const STORAGE_KEY = 'seg_nestorx_size';
  const sizes = {
    small: 'Pequeno',
    medium: 'Médio',
    large: 'Grande'
  };
  const validSize = value => Object.prototype.hasOwnProperty.call(sizes, value) ? value : 'medium';
  let saved = 'medium';
  try { saved = validSize(localStorage.getItem(STORAGE_KEY)); } catch { /* armazenamento indisponível */ }

  const control = document.createElement('div');
  control.className = 'nestorx-size-control';
  control.setAttribute('role', 'group');
  control.setAttribute('aria-label', 'Tamanho do NestorX');
  control.innerHTML = `<span class="nestorx-size-label">Tamanho do NestorX</span><div class="nestorx-size-options">${Object.entries(sizes).map(([value, label]) => `<button class="nestorx-size-option" type="button" data-nestorx-size="${value}" aria-pressed="false">${label}</button>`).join('')}</div>`;
  const actions = tip.querySelector('.nestorx-tip-actions');
  if (actions) actions.before(control);
  else tip.append(control);

  const buttons = Array.from(control.querySelectorAll('[data-nestorx-size]'));
  function applySize(value) {
    const next = validSize(value);
    mover.classList.remove('nestorx-size-small', 'nestorx-size-medium', 'nestorx-size-large');
    mover.classList.add(`nestorx-size-${next}`);
    mover.dataset.nestorxSize = next;
    buttons.forEach(button => {
      const selected = button.dataset.nestorxSize === next;
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* armazenamento indisponível */ }
    // O controlador de movimento recalcula limites, cesta e painel de ajuda.
    window.dispatchEvent(new Event('resize'));
  }

  buttons.forEach(button => button.addEventListener('click', () => applySize(button.dataset.nestorxSize)));
  applySize(saved);
})();
