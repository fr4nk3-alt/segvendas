'use strict';

/* Versão 5.9.7 — evita colisão entre a ajuda do NestorX, a cesta e o avatar. */
(() => {
  const dock = document.getElementById('seguitoDock');
  const mover = document.getElementById('nestorxMover');
  const tip = document.getElementById('seguitoTip');
  const basket = document.getElementById('floatingBasket');
  const basketPanel = document.getElementById('floatingBasketPanel');
  const basketToggle = document.getElementById('floatingBasketToggle');
  const avatar = document.getElementById('seguitoDockButton');
  if (!dock || !mover || !tip || !basket || !basketToggle || !avatar) return;

  let frame = 0;

  const isTipOpen = () => !tip.classList.contains('hidden');
  const viewport = () => {
    const vv = window.visualViewport;
    return {
      left: vv?.offsetLeft || 0,
      top: vv?.offsetTop || 0,
      width: vv?.width || window.innerWidth,
      height: vv?.height || window.innerHeight
    };
  };

  function overlaps(candidate, rect, gap = 12) {
    return candidate.x < rect.right + gap
      && candidate.x + candidate.width > rect.left - gap
      && candidate.y < rect.bottom + gap
      && candidate.y + candidate.height > rect.top - gap;
  }

  function safeBasketPoint() {
    const view = viewport();
    const toggleRect = basketToggle.getBoundingClientRect();
    const width = Math.max(44, toggleRect.width || 52);
    const height = Math.max(40, toggleRect.height || 48);
    const margin = 12;
    const nav = document.querySelector('.bottom-nav');
    const navRect = nav && !nav.classList.contains('hidden') ? nav.getBoundingClientRect() : null;
    const maxBottom = Math.min(
      view.top + view.height - margin - height,
      navRect ? navRect.top - margin - height : view.top + view.height - margin - height
    );
    const minTop = view.top + margin;
    const safeMaxBottom = Math.max(minTop, maxBottom);
    const maxLeft = view.left + view.width - margin - width;
    const tipRect = tip.getBoundingClientRect();
    const avatarRect = avatar.getBoundingClientRect();
    const forbidden = [tipRect, avatarRect];
    if (navRect) forbidden.push({ left: navRect.left, right: navRect.right, top: navRect.top - 8, bottom: view.top + view.height + 8 });

    const clamp = (x, y) => ({
      x: Math.max(view.left + margin, Math.min(maxLeft, x)),
      y: Math.max(minTop, Math.min(safeMaxBottom, y)),
      width,
      height
    });
    const candidates = [
      clamp(maxLeft, maxBottom),
      clamp(view.left + margin, maxBottom),
      clamp(maxLeft, minTop),
      clamp(view.left + margin, minTop),
      clamp(maxLeft, view.top + (view.height - height) / 2),
      clamp(view.left + margin, view.top + (view.height - height) / 2)
    ];
    const current = { x: toggleRect.left, y: toggleRect.top };
    const available = candidates.find(candidate => !forbidden.some(rect => overlaps(candidate, rect)));
    if (available) return available;

    // Em telas muito baixas pode não existir um canto completamente livre;
    // escolha o que menos invade os retângulos proibidos.
    const score = candidate => forbidden.reduce((total, rect) => {
      const x = Math.max(0, Math.min(candidate.x + candidate.width, rect.right) - Math.max(candidate.x, rect.left));
      const y = Math.max(0, Math.min(candidate.y + candidate.height, rect.bottom) - Math.max(candidate.y, rect.top));
      return total + x * y;
    }, 0) + Math.abs(candidate.x - current.x) * .03 + Math.abs(candidate.y - current.y) * .03;
    return candidates.sort((a, b) => score(a) - score(b))[0] || clamp(maxLeft, maxBottom);
  }

  function restoreBasketPosition() {
    dock.classList.remove('nestorx-help-open');
    basket.classList.remove('is-help-safe');
    basket.style.removeProperty('--basket-safe-left');
    basket.style.removeProperty('--basket-safe-top');
    basket.style.removeProperty('left');
    basket.style.removeProperty('right');
    basket.style.removeProperty('top');
    basket.style.removeProperty('bottom');
  }

  function applySafeBasketPosition() {
    dock.classList.add('nestorx-help-open');
    if (basket.classList.contains('hidden')) return;
    // O painel completo fecha para que os dois grandes painéis nunca se
    // sobreponham; o botão compacto continua disponível para reabrir a cesta.
    basketPanel?.classList.add('hidden');
    basketToggle.setAttribute('aria-expanded', 'false');
    dock.classList.remove('basket-thought-open');
    basket.classList.add('is-help-safe');
    const point = safeBasketPoint();
    const moverRect = mover.getBoundingClientRect();
    const left = Math.round(point.x - moverRect.left);
    const top = Math.round(point.y - moverRect.top);
    basket.style.setProperty('--basket-safe-left', `${left}px`);
    basket.style.setProperty('--basket-safe-top', `${top}px`);
  }

  function syncLayout() {
    frame = 0;
    if (isTipOpen()) applySafeBasketPosition();
    else restoreBasketPosition();
  }

  function schedule() {
    if (frame) return;
    frame = window.requestAnimationFrame(syncLayout);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(tip, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  observer.observe(mover, { attributes: true, attributeFilter: ['class', 'style'] });
  observer.observe(basket, { attributes: true, attributeFilter: ['class', 'hidden'] });
  window.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('pointerup', schedule, true);
  document.addEventListener('transitionend', schedule, true);
  schedule();
})();
