'use strict';

(() => {
  const dock = document.getElementById('seguitoDock');
  if (!dock) return;

  // v55 monta o avatar antigo antes deste arquivo. Recriamos os nós para também
  // remover os eventos antigos e manter um único controlador para o NestorX.
  dock.removeAttribute('aria-live');
  dock.classList.add('seguito-dock', 'nestorx-roamer');
  dock.innerHTML = `<div class="nestorx-mover is-left" id="nestorxMover">
    <button class="nestorx-avatar-button" id="seguitoDockButton" type="button" aria-label="Abrir funções do NestorX; arraste para mover" aria-controls="seguitoTip" aria-expanded="false" title="Abrir funções do NestorX — arraste para mover"><picture class="nestorx-picture"><source srcset="assets/nestorx-fullbody.webp" type="image/webp"><img class="nestorx-figure" src="assets/nestorx-fullbody.png" alt="NestorX" width="559" height="1623" decoding="async"></picture></button>
    <section class="seguito-tip nestorx-tip hidden" id="seguitoTip" role="dialog" aria-labelledby="nestorxTipTitle" aria-describedby="seguitoTipText nestorxHelpFeedback">
      <button id="closeSeguitoTip" type="button" aria-label="Fechar ajuda do NestorX" title="Fechar">×</button>
      <strong id="nestorxTipTitle">NestorX</strong>
      <p id="seguitoTipText">Como posso ajudar?</p>
      <form class="nestorx-help-form" id="nestorxHelpForm">
        <label class="visually-hidden" for="nestorxHelpInput">O que você deseja encontrar?</label>
        <div class="nestorx-help-row">
          <input id="nestorxHelpInput" type="search" autocomplete="off" minlength="2" maxlength="160" placeholder="Ex.: manual, cliente ou câmera">
          <button class="nestorx-help-send" type="submit" aria-label="Enviar pergunta" title="Enviar pergunta">➜</button>
        </div>
      </form>
      <p class="nestorx-help-feedback hidden" id="nestorxHelpFeedback" role="status" aria-live="polite"></p>
      <p class="nestorx-motion-status hidden" id="nestorxMotionStatus" role="status"></p>
      <div class="nestorx-tip-actions" role="group" aria-label="Controles do NestorX">
        <button class="nestorx-icon-action" id="nestorxPauseButton" type="button" aria-label="Pausar movimento do NestorX" title="Pausar movimento"><span id="nestorxPauseGlyph" aria-hidden="true">⏸</span></button>
        <button class="nestorx-icon-action" id="nestorxHideButton" type="button" aria-label="Ocultar NestorX" title="Ocultar NestorX"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5.2 0 8.6 4.5 9.5 6a2 2 0 0 1 0 2 16 16 0 0 1-2.2 2.8M6.6 6.5A16.7 16.7 0 0 0 2.5 10a2 2 0 0 0 0 2c.9 1.5 4.3 6 9.5 6 1 0 2-.2 2.9-.5"/></svg></button>
      </div>
    </section>
    <button class="nestorx-restore-button hidden" id="nestorxRestoreButton" type="button" aria-label="Mostrar NestorX" title="Mostrar NestorX">💡</button>
  </div>`;

  const mover = document.getElementById('nestorxMover');
  const lamp = document.getElementById('seguitoDockButton');
  const tip = document.getElementById('seguitoTip');
  const tipText = document.getElementById('seguitoTipText');
  const closeButton = document.getElementById('closeSeguitoTip');
  const helpForm = document.getElementById('nestorxHelpForm');
  const helpInput = document.getElementById('nestorxHelpInput');
  const helpFeedback = document.getElementById('nestorxHelpFeedback');
  const motionStatus = document.getElementById('nestorxMotionStatus');
  const pauseButton = document.getElementById('nestorxPauseButton');
  const pauseGlyph = document.getElementById('nestorxPauseGlyph');
  const hideButton = document.getElementById('nestorxHideButton');
  const restoreButton = document.getElementById('nestorxRestoreButton');
  if (!mover || !lamp || !tip || !tipText || !closeButton || !helpForm || !helpInput || !helpFeedback || !motionStatus || !pauseButton || !pauseGlyph || !hideButton || !restoreButton) return;

  const STORAGE = {
    paused: 'seg_nestorx_motion_paused',
    hidden: 'seg_nestorx_hidden',
    side: 'seg_nestorx_side',
    slot: 'seg_nestorx_slot'
  };
  const motionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const state = {
    x: 12,
    y: 88,
    side: read(STORAGE.side, 'left') === 'right' ? 'right' : 'left',
    slot: clamp(Number(read(STORAGE.slot, '2')) || 2, 0, 4),
    paused: read(STORAGE.paused, '0') === '1',
    hidden: read(STORAGE.hidden, '0') === '1',
    reduced: Boolean(motionMedia?.matches),
    dragging: false,
    dragMoved: false,
    suppressClick: false,
    temporaryPause: false,
    moveCount: 0,
    roamTimer: 0,
    walkTimer: 0,
    teleportTimer: 0,
    typingTimer: 0,
    layoutTimer: 0,
    routeTimer: 0,
    pointer: null
  };

  function read(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, String(value)); } catch { /* armazenamento indisponível */ }
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function isVisible(element) {
    if (!element || dock.contains(element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
  }

  function dimensions() {
    const style = getComputedStyle(mover);
    const height = parseFloat(style.getPropertyValue('--nestorx-height')) || mover.offsetHeight || 218;
    const width = parseFloat(style.getPropertyValue('--nestorx-width')) || mover.offsetWidth || 76;
    return { width, height };
  }

  function limits() {
    const viewport = window.visualViewport;
    const viewportWidth = Math.max(240, viewport?.width || window.innerWidth);
    const viewportHeight = Math.max(240, viewport?.height || window.innerHeight);
    const offsetTop = Math.max(0, viewport?.offsetTop || 0);
    const header = document.querySelector('.app-header');
    const nav = document.querySelector('.bottom-nav');
    const headerBottom = isVisible(header) ? Math.max(0, header.getBoundingClientRect().bottom) : offsetTop;
    const navTop = isVisible(nav) ? nav.getBoundingClientRect().top : offsetTop + viewportHeight;
    const { width, height } = dimensions();
    const top = Math.max(offsetTop + 8, headerBottom + 8);
    const bottom = Math.max(top, Math.min(offsetTop + viewportHeight - 8, navTop - 8));
    return {
      width,
      height,
      viewportWidth,
      viewportHeight,
      left: 7,
      right: Math.max(7, viewportWidth - width - 7),
      top,
      maxY: Math.max(top, bottom - height)
    };
  }

  function obstacles() {
    const selector = [
      '.page.active input:not([disabled])',
      '.page.active select:not([disabled])',
      '.page.active textarea:not([disabled])',
      '.page.active button:not([disabled])',
      '.page.active a[href]',
      '.quote-step-navigation',
      '.toast.show'
    ].join(',');
    return Array.from(document.querySelectorAll(selector)).filter(isVisible).map(element => element.getBoundingClientRect());
  }

  function overlapScore(anchor, rects) {
    const buffer = window.innerWidth <= 650 ? 9 : 12;
    // A lâmpada fica ao lado do mascote; reserve todo o alcance dela ao
    // escolher um ponto para não cobrir botões e campos da página.
    const lampReach = 54;
    const a = {
      left: anchor.x - buffer - lampReach,
      top: anchor.y - buffer,
      right: anchor.x + anchor.width + buffer + lampReach,
      bottom: anchor.y + anchor.height + buffer
    };
    return rects.reduce((score, b) => {
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return score + (width && height ? 100000 + (width * height) : 0);
    }, 0);
  }

  function candidates() {
    const bound = limits();
    const range = Math.max(0, bound.maxY - bound.top);
    const fractions = window.innerWidth <= 650 ? [0, .34, .67, 1] : [0, .25, .5, .75, 1];
    const rects = obstacles();
    const list = [];
    ['left', 'right'].forEach(side => {
      fractions.forEach((fraction, slot) => {
        const anchor = {
          side,
          slot,
          x: side === 'left' ? bound.left : bound.right,
          y: Math.round(bound.top + range * fraction),
          width: bound.width,
          height: bound.height
        };
        anchor.score = overlapScore(anchor, rects);
        list.push(anchor);
      });
    });
    return list;
  }

  function bestAnchor({ forceOtherSide = false, preferredSlot = null } = {}) {
    const list = candidates();
    const wantedSide = forceOtherSide ? (state.side === 'left' ? 'right' : 'left') : state.side;
    let pool = list.filter(anchor => anchor.side === wantedSide && anchor.slot !== state.slot);
    if (preferredSlot !== null) {
      const exact = list.find(anchor => anchor.side === wantedSide && anchor.slot === preferredSlot);
      if (exact?.score === 0) return exact;
    }
    const safe = pool.filter(anchor => anchor.score === 0);
    if (safe.length) pool = safe;
    if (!pool.length) pool = list.filter(anchor => anchor.side === wantedSide);
    if (!pool.length) pool = list;
    const minimumDistance = window.innerWidth <= 650 ? 48 : 100;
    const distance = anchor => Math.hypot(anchor.x - state.x, anchor.y - state.y);
    let distant = pool.filter(anchor => distance(anchor) >= minimumDistance);
    if (!distant.length && !forceOtherSide && preferredSlot === null) {
      const all = list.filter(anchor => anchor.side !== state.side || anchor.slot !== state.slot);
      const allSafe = all.filter(anchor => anchor.score === 0 && distance(anchor) >= minimumDistance);
      distant = allSafe.length ? allSafe : all.filter(anchor => distance(anchor) >= minimumDistance);
    }
    if (distant.length) pool = distant;
    pool.sort((a, b) => a.score - b.score || distance(b) - distance(a));
    return pool[0];
  }

  function setTransform(x, y) {
    state.x = Math.round(x);
    state.y = Math.round(y);
    mover.classList.toggle('is-lower-half', state.y + dimensions().height / 2 > (window.visualViewport?.height || window.innerHeight) / 2);
    mover.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
  }

  function currentVisualPosition() {
    const transform = getComputedStyle(mover).transform;
    if (!transform || transform === 'none') return { x: state.x, y: state.y };
    const open = transform.indexOf('(');
    const close = transform.lastIndexOf(')');
    const values = open >= 0 && close > open
      ? transform.slice(open + 1, close).split(',').map(value => Number(value.trim()))
      : [];
    if (transform.startsWith('matrix3d(') && values.length >= 14) return { x: values[12], y: values[13] };
    if (transform.startsWith('matrix(') && values.length >= 6) return { x: values[4], y: values[5] };
    return { x: state.x, y: state.y };
  }

  function setSide(side) {
    state.side = side === 'right' ? 'right' : 'left';
    mover.classList.toggle('is-left', state.side === 'left');
    mover.classList.toggle('is-right', state.side === 'right');
    write(STORAGE.side, state.side);
  }

  function finishWalk() {
    clearTimeout(state.walkTimer);
    mover.classList.remove('is-walking');
  }

  function moveTo(anchor, { immediate = false, teleport = false } = {}) {
    if (!anchor) return;
    clearTimeout(state.teleportTimer);
    finishWalk();
    const sideChanged = anchor.side !== state.side;
    const apply = () => {
      setSide(anchor.side);
      state.slot = anchor.slot;
      write(STORAGE.slot, state.slot);
      setTransform(anchor.x, anchor.y);
      if (!immediate && !state.reduced) {
        mover.classList.add('is-walking');
        state.walkTimer = setTimeout(finishWalk, 2850);
      }
    };

    // Uma troca de lado não atravessa formulários: ele some de uma borda e
    // reaparece suavemente na outra.
    if (!immediate && sideChanged && teleport && !state.reduced) {
      mover.classList.add('is-teleporting');
      state.teleportTimer = setTimeout(() => {
        apply();
        requestAnimationFrame(() => requestAnimationFrame(() => mover.classList.remove('is-teleporting')));
      }, 190);
      return;
    }
    apply();
  }

  function dockAvailable() {
    return !dock.classList.contains('hidden') && !document.body.classList.contains('auth-locked');
  }

  function modalOpen() {
    return document.body.classList.contains('modal-open') || Boolean(document.querySelector('.modal:not(.hidden)'));
  }

  function tipOpen() { return !tip.classList.contains('hidden'); }
  function cancelRoam() { clearTimeout(state.roamTimer); state.roamTimer = 0; }

  function shouldRoam() {
    return dockAvailable() && !dock.classList.contains('basket-thought-open') && !dock.classList.contains('basket-search-typing') && !state.hidden && !state.paused && !state.reduced && !state.dragging && !state.temporaryPause && !tipOpen() && !document.hidden && !modalOpen();
  }

  function scheduleRoam(delay) {
    cancelRoam();
    if (!shouldRoam()) return;
    const mobile = window.innerWidth <= 650;
    const wait = delay ?? ((mobile ? 7200 : 6200) + Math.round(Math.random() * 2600));
    state.roamTimer = setTimeout(() => {
      if (!shouldRoam()) return;
      state.moveCount += 1;
      const changeSide = state.moveCount % 2 === 0;
      moveTo(bestAnchor({ forceOtherSide: changeSide }));
      scheduleRoam();
    }, wait);
  }

  function pauseForTyping() {
    state.temporaryPause = true;
    cancelRoam();
    finishWalk();
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => {
      state.temporaryPause = false;
      refreshLifecycle({ roamDelay: 1800 });
    }, 1600);
  }

  function normalizeHelpText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function helpSubject(value, extraStops = []) {
    const stops = new Set([
      'a', 'ao', 'abrir', 'abre', 'achar', 'ajuda', 'de', 'do', 'da', 'dos', 'das', 'e', 'em',
      'encontrar', 'eu', 'favor', 'ir', 'me', 'mostra', 'mostrar', 'no', 'na', 'o', 'onde', 'para',
      'pesquisa', 'pesquisar', 'procura', 'procurar', 'quero', 'queria', 'um', 'uma', ...extraStops
    ]);
    const useful = String(value || '').split(/\s+/).filter(word => {
      const clean = normalizeHelpText(word).replace(/[^a-z0-9]/g, '');
      return clean && !stops.has(clean);
    });
    return useful.join(' ').trim() || String(value || '').trim();
  }

  function showHelpFeedback(message, isError = false) {
    helpFeedback.textContent = message;
    helpFeedback.classList.remove('hidden');
    helpFeedback.classList.toggle('is-error', isError);
  }

  function pageAllowed(page) {
    const button = document.querySelector(`.nav-btn[data-page="${page}"]`);
    return Boolean(button && !button.classList.contains('role-hidden'));
  }

  function openAllowedPage(page) {
    if (!pageAllowed(page)) return false;
    try {
      if (typeof navigateToPage === 'function') navigateToPage(page);
      else document.querySelector(`.nav-btn[data-page="${page}"]`)?.click();
      return true;
    } catch { return false; }
  }

  function fillDestination(id, value) {
    setTimeout(() => {
      const input = document.getElementById(id);
      if (!input) return;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus({ preventScroll: true });
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 140);
  }

  function routeAfterFeedback(label, action) {
    showHelpFeedback(`Certo — abrindo ${label}.`);
    clearTimeout(state.routeTimer);
    state.routeTimer = setTimeout(() => {
      state.routeTimer = 0;
      helpInput.value = '';
      closeTip(false);
      action();
      requestAnimationFrame(() => {
        if (!tip.contains(document.activeElement)) return;
        const modal = document.querySelector('.modal:not(.hidden)');
        const modalTarget = modal?.querySelector('input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled])');
        if (modalTarget) { modalTarget.focus({ preventScroll: true }); return; }
        const activePage = document.querySelector('.page.active:not(.role-hidden)');
        const page = activePage?.id?.replace(/^page-/, '');
        document.querySelector(`.nav-btn[data-page="${page}"]:not(.role-hidden)`)?.focus({ preventScroll: true });
      });
      try { if (typeof showToast === 'function') showToast(`NestorX abriu ${label}`); } catch { /* compatibilidade */ }
    }, 360);
  }

  function routeHelpRequest(rawValue) {
    const raw = String(rawValue || '').trim();
    if (raw.length < 2) {
      showHelpFeedback('Digite pelo menos 2 caracteres.', true);
      helpInput.focus({ preventScroll: true });
      return;
    }

    let user = null;
    try { user = typeof currentUser === 'undefined' ? null : currentUser; } catch { /* ambiente de teste */ }
    if (!user && document.body.classList.contains('auth-locked')) {
      showHelpFeedback('Entre no sistema para eu abrir a área certa.', true);
      return;
    }
    if (user?.mustChangePassword && typeof openChangePasswordModal === 'function') {
      routeAfterFeedback('Segurança', () => openChangePasswordModal());
      return;
    }

    const query = normalizeHelpText(raw);
    const has = words => words.some(word => query.includes(word));
    const productIntent = has(['produto', 'catalogo', 'preco', 'valor', 'codigo', 'camera', 'dvr', 'motor', 'portao', 'fechadura', 'alarme', 'sensor', 'cabo', 'controle', 'interfone', 'automatizador', 'fonte', 'nobreak', 'placa']);
    const quoteIntent = has(['orcamento', 'cotacao', 'proposta', 'venda']);

    if (has(['senha', 'trocar senha', 'login'])) {
      routeAfterFeedback('Troca de senha', () => {
        if (typeof openChangePasswordModal === 'function') openChangePasswordModal();
        else document.getElementById('changePasswordBtn')?.click();
      });
      return;
    }

    if (has(['seguranca', 'protecao', 'sessao'])) {
      routeAfterFeedback('Segurança do acesso', () => {
        const securityCard = document.getElementById('securityStatusCard');
        if (pageAllowed('settings') && securityCard) {
          openAllowedPage('settings');
          setTimeout(() => securityCard.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);
        } else if (typeof openChangePasswordModal === 'function') openChangePasswordModal();
        else document.getElementById('changePasswordBtn')?.click();
      });
      return;
    }

    if (has(['entrega', 'frete', 'recebimento', 'finalizar', 'revisar', 'compartilhar', 'enviar orcamento']) || (quoteIntent && has(['pdf']))) {
      if (!pageAllowed('quote')) { showHelpFeedback('Seu perfil não tem acesso à finalização de orçamentos.', true); return; }
      routeAfterFeedback('Finalizar orçamento e entrega', () => {
        openAllowedPage('quote');
        if (typeof showQuoteStep === 'function') showQuoteStep(4);
      });
      return;
    }

    if (has(['historico', 'orcamentos salvos', 'orcamento salvo', 'anteriores', 'exportar'])) {
      if (!pageAllowed('history')) { showHelpFeedback('Seu perfil não tem acesso ao histórico.', true); return; }
      routeAfterFeedback('Histórico', () => openAllowedPage('history'));
      return;
    }

    if (has(['importar', 'planilha', 'csv', 'xls', 'funcionario', 'base de clientes', 'ajustes', 'configuracoes do aplicativo', 'pasta de fotos'])) {
      if (!pageAllowed('settings')) { showHelpFeedback('Importações e ajustes são restritos à coordenação.', true); return; }
      const employeeImport = has(['funcionario']);
      if (employeeImport && user?.role !== 'admin') { showHelpFeedback('A importação de funcionários é restrita ao administrador.', true); return; }
      const targetId = employeeImport ? 'employeeImportCard' : has(['cliente', 'base de clientes']) ? 'clientImportCard' : has(['foto']) ? 'photoDirectoryCard' : '';
      routeAfterFeedback('Ajustes', () => {
        openAllowedPage('settings');
        if (targetId) setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);
      });
      return;
    }

    if (has(['cliente', 'cpf', 'cnpj', 'cadastro', 'bloquear'])) {
      const searchButton = document.getElementById('searchClientBtn');
      if (!pageAllowed('quote') || searchButton?.classList.contains('hidden')) {
        showHelpFeedback('A pesquisa de clientes é restrita aos funcionários autorizados.', true);
        return;
      }
      routeAfterFeedback('Pesquisa de clientes', () => {
        openAllowedPage('quote');
        if (typeof showQuoteStep === 'function') showQuoteStep(2);
        setTimeout(() => searchButton?.click(), 220);
      });
      return;
    }

    if (has(['forum', 'comunidade', 'publicar duvida'])) {
      if (!pageAllowed('support')) { showHelpFeedback('Seu perfil não tem acesso ao suporte.', true); return; }
      const forumButton = document.getElementById('forumTabBtn');
      const forumAllowed = forumButton && !forumButton.classList.contains('role-hidden');
      routeAfterFeedback(forumAllowed ? 'Fórum técnico' : 'Manuais', () => {
        openAllowedPage('support');
        if (typeof activateSupportTab === 'function') activateSupportTab(forumAllowed ? 'forum' : 'manuals');
        if (forumAllowed) fillDestination('forumSearchInput', helpSubject(raw, ['forum', 'comunidade']));
        else fillDestination('manualSearchInput', helpSubject(raw, ['forum', 'comunidade']));
      });
      return;
    }

    if (has(['manual', 'documentacao', 'instalacao', 'configuracao', 'defeito', 'diagnostico', 'compatibilidade', 'garen', 'hikvision', 'jfl', 'ipec', 'suporte', 'duvida tecnica'])) {
      if (!pageAllowed('support')) { showHelpFeedback('Seu perfil não tem acesso aos manuais.', true); return; }
      const subject = helpSubject(raw, ['manual', 'manuais', 'documentacao', 'suporte']);
      routeAfterFeedback('Manuais e suporte', () => {
        openAllowedPage('support');
        if (typeof activateSupportTab === 'function') activateSupportTab('manuals');
        fillDestination('manualSearchInput', subject);
      });
      return;
    }

    if (quoteIntent && productIntent) {
      if (!pageAllowed('quote')) { showHelpFeedback('Seu perfil não pode criar orçamentos.', true); return; }
      const subject = helpSubject(raw, ['orcamento', 'cotacao', 'proposta', 'venda', 'produto', 'preco', 'valor', 'codigo']);
      routeAfterFeedback('Produtos do orçamento', () => {
        openAllowedPage('quote');
        if (typeof showQuoteStep === 'function') showQuoteStep(3);
        fillDestination('quoteSearchInput', subject);
      });
      return;
    }

    if (quoteIntent) {
      if (!pageAllowed('quote')) { showHelpFeedback('Seu perfil não pode criar orçamentos.', true); return; }
      routeAfterFeedback('Novo orçamento', () => {
        openAllowedPage('quote');
        if (typeof showQuoteStep === 'function') showQuoteStep(1);
      });
      return;
    }

    if (productIntent || /\b\d{3,14}\b/.test(query)) {
      if (!pageAllowed('products')) { showHelpFeedback('Seu perfil não tem acesso ao catálogo.', true); return; }
      const subject = helpSubject(raw, ['produto', 'produtos', 'catalogo', 'preco', 'valor', 'codigo']);
      routeAfterFeedback('Catálogo de produtos', () => {
        openAllowedPage('products');
        fillDestination('catalogSearchInput', subject);
      });
      return;
    }

    if (pageAllowed('assistant')) {
      routeAfterFeedback('Assistente', () => {
        openAllowedPage('assistant');
        setTimeout(() => {
          const chatInput = document.getElementById('chatInput');
          if (typeof sendAssistantMessage === 'function') sendAssistantMessage(raw);
          if (chatInput) { chatInput.value = ''; chatInput.focus({ preventScroll: true }); }
        }, 140);
      });
      return;
    }

    if (pageAllowed('products')) {
      routeAfterFeedback('Catálogo de produtos', () => {
        openAllowedPage('products');
        fillDestination('catalogSearchInput', raw);
      });
      return;
    }
    showHelpFeedback('Não encontrei uma área disponível para seu perfil.', true);
  }

  function updateControls() {
    pauseButton.disabled = state.reduced;
    pauseButton.classList.toggle('nestorx-system-motion-warning', state.reduced);
    const pauseLabel = state.reduced ? 'Animação desativada pelo Windows' : (state.paused ? 'Retomar movimento do NestorX' : 'Pausar movimento do NestorX');
    pauseButton.setAttribute('aria-label', pauseLabel);
    pauseButton.title = pauseLabel;
    pauseGlyph.textContent = state.paused ? '▶' : '⏸';
    motionStatus.textContent = state.reduced ? 'Animação desativada pelo Windows' : '';
    motionStatus.classList.toggle('hidden', !state.reduced);
    dock.classList.toggle('is-user-hidden', state.hidden);
    restoreButton.classList.toggle('hidden', !state.hidden);
    if (state.hidden) closeTip(false);
  }

  function refreshLifecycle({ reposition = false, roamDelay = null } = {}) {
    const suspended = document.hidden || modalOpen();
    const basketOpen = dock.classList.contains('basket-thought-open');
    const searchTyping = dock.classList.contains('basket-search-typing');
    dock.classList.toggle('is-suspended', suspended);
    if (!dockAvailable() || suspended || basketOpen || searchTyping || state.temporaryPause || state.hidden || state.paused || state.reduced || tipOpen()) {
      const visual = (basketOpen || searchTyping) && !state.dragging ? currentVisualPosition() : null;
      cancelRoam();
      finishWalk();
      if (visual) {
        mover.classList.add('is-positioning');
        setTransform(visual.x, visual.y);
        requestAnimationFrame(() => requestAnimationFrame(() => mover.classList.remove('is-positioning')));
      }
    } else {
      scheduleRoam(roamDelay ?? (reposition ? 2600 : undefined));
    }
    if (reposition && !basketOpen && !searchTyping && dockAvailable() && !state.dragging && !tipOpen()) {
      moveTo(bestAnchor({ preferredSlot: state.slot }), { immediate: true });
    }
  }

  function showTip() {
    if (state.hidden || !dockAvailable()) return;
    const visual = currentVisualPosition();
    finishWalk();
    mover.classList.add('is-positioning');
    setTransform(visual.x, visual.y);
    tipText.textContent = 'Como posso ajudar?';
    helpFeedback.textContent = '';
    helpFeedback.classList.add('hidden');
    helpFeedback.classList.remove('is-error');
    tip.classList.remove('hidden');
    lamp.setAttribute('aria-expanded', 'true');
    cancelRoam();
    requestAnimationFrame(() => {
      keepOpenTipVisible();
      requestAnimationFrame(() => mover.classList.remove('is-positioning'));
    });
  }

  function closeTip(returnFocus = false) {
    clearTimeout(state.routeTimer);
    state.routeTimer = 0;
    tip.classList.add('hidden');
    lamp.setAttribute('aria-expanded', 'false');
    if (returnFocus && !state.hidden) lamp.focus({ preventScroll: true });
    scheduleRoam(7200);
  }

  function toggleTip() { tipOpen() ? closeTip(false) : showTip(); }

  function keepOpenTipVisible() {
    if (!tipOpen()) return;
    tip.style.setProperty('--nestorx-tip-shift-x', '0px');
    tip.style.setProperty('--nestorx-tip-shift-y', '0px');
    const viewport = window.visualViewport;
    const left = (viewport?.offsetLeft || 0) + 8;
    const top = (viewport?.offsetTop || 0) + 8;
    const right = left + (viewport?.width || window.innerWidth) - 16;
    const bottom = top + (viewport?.height || window.innerHeight) - 16;
    if (window.innerWidth <= 650 || (viewport?.height || window.innerHeight) <= 520) {
      tip.style.maxHeight = `${Math.max(96, Math.floor(bottom - top))}px`;
    } else {
      tip.style.removeProperty('max-height');
    }
    const visual = currentVisualPosition();
    finishWalk();
    mover.classList.add('is-positioning');
    setTransform(visual.x, visual.y);
    requestAnimationFrame(() => {
      const rect = tip.getBoundingClientRect();
      let dx = rect.left < left ? left - rect.left : 0;
      if (rect.right + dx > right) dx -= rect.right + dx - right;
      let dy = rect.top < top ? top - rect.top : 0;
      if (rect.bottom + dy > bottom) dy -= rect.bottom + dy - bottom;

      // Quando a cesta estiver aberta, desloque somente a caixa de ajuda.
      // A cesta acompanha o avatar, então mover o avatar inteiro não resolveria a colisão.
      const basketPanel = document.getElementById('floatingBasketPanel');
      const basketRect = basketPanel && !basketPanel.classList.contains('hidden')
        ? basketPanel.getBoundingClientRect()
        : null;
      const overlaps = (a, b, offsetX = 0, offsetY = 0) => (
        a.left + offsetX < b.right && a.right + offsetX > b.left
        && a.top + offsetY < b.bottom && a.bottom + offsetY > b.top
      );
      let tipDx = 0;
      let tipDy = 0;
      if (basketRect && overlaps(rect, basketRect)) {
        const gap = 14;
        const moveLeft = rect.left + rect.width / 2 >= basketRect.left + basketRect.width / 2;
        tipDx += moveLeft
          ? basketRect.left - gap - rect.right
          : basketRect.right + gap - rect.left;
        if (overlaps(rect, basketRect, tipDx, 0)) {
          const moveUp = rect.top + rect.height / 2 >= basketRect.top + basketRect.height / 2;
          tipDy += moveUp
            ? basketRect.top - gap - rect.bottom
            : basketRect.bottom + gap - rect.top;
        }
      }
      const finalLeft = rect.left + dx + tipDx;
      const finalRight = rect.right + dx + tipDx;
      const finalTop = rect.top + dy + tipDy;
      const finalBottom = rect.bottom + dy + tipDy;
      if (finalLeft < left) tipDx += left - finalLeft;
      if (finalRight > right) tipDx -= finalRight - right;
      if (finalTop < top) tipDy += top - finalTop;
      if (finalBottom > bottom) tipDy -= finalBottom - bottom;
      tip.style.setProperty('--nestorx-tip-shift-x', `${Math.round(tipDx)}px`);
      tip.style.setProperty('--nestorx-tip-shift-y', `${Math.round(tipDy)}px`);
      if (rect.top + dy < top) dy = top - rect.top;
      if (rect.bottom + dy > bottom) dy = bottom - rect.bottom;
      setTransform(state.x + dx, state.y + dy);
      requestAnimationFrame(() => mover.classList.remove('is-positioning'));
    });
  }

  function setPaused(value) {
    state.paused = Boolean(value);
    write(STORAGE.paused, state.paused ? '1' : '0');
    updateControls();
    refreshLifecycle();
  }

  function setHidden(value) {
    state.hidden = Boolean(value);
    write(STORAGE.hidden, state.hidden ? '1' : '0');
    updateControls();
    if (!state.hidden) {
      moveTo(bestAnchor({ preferredSlot: state.slot }), { immediate: true });
      restoreButton.classList.add('hidden');
      lamp.focus({ preventScroll: true });
    } else {
      requestAnimationFrame(() => restoreButton.focus({ preventScroll: true }));
    }
    refreshLifecycle();
  }

  function nearestAnchor() {
    return candidates().sort((a, b) => Math.hypot(a.x - state.x, a.y - state.y) - Math.hypot(b.x - state.x, b.y - state.y))[0];
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const visual = currentVisualPosition();
    state.pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, originX: visual.x, originY: visual.y };
    state.dragging = true;
    state.dragMoved = false;
    cancelRoam();
    finishWalk();
    mover.classList.add('is-dragging');
    setTransform(visual.x, visual.y);
    lamp.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!state.dragging || !state.pointer || event.pointerId !== state.pointer.id) return;
    const dx = event.clientX - state.pointer.startX;
    const dy = event.clientY - state.pointer.startY;
    if (Math.hypot(dx, dy) > 6) state.dragMoved = true;
    if (!state.dragMoved) return;
    const bound = limits();
    setTransform(clamp(state.pointer.originX + dx, bound.left, bound.right), clamp(state.pointer.originY + dy, bound.top, bound.maxY));
    event.preventDefault();
  }

  function onPointerEnd(event) {
    if (!state.dragging || !state.pointer || event.pointerId !== state.pointer.id) return;
    const moved = state.dragMoved;
    state.dragging = false;
    state.pointer = null;
    mover.classList.remove('is-dragging');
    try { lamp.releasePointerCapture?.(event.pointerId); } catch { /* captura já liberada */ }
    if (moved) {
      state.suppressClick = true;
      closeTip(false);
      moveTo(nearestAnchor(), { immediate: state.reduced });
      setTimeout(() => { state.suppressClick = false; }, 380);
    }
    scheduleRoam(14000);
  }

  // Captura antes dos eventos herdados de app.js/v55.js, evitando o antigo
  // abre-e-fecha duplo da lâmpada.
  lamp.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (state.suppressClick) return;
    toggleTip();
  }, true);
  closeButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeTip(true);
  }, true);
  lamp.addEventListener('pointerdown', onPointerDown);
  lamp.addEventListener('pointermove', onPointerMove);
  lamp.addEventListener('pointerup', onPointerEnd);
  lamp.addEventListener('pointercancel', onPointerEnd);
  window.addEventListener('pointerup', onPointerEnd);
  window.addEventListener('pointercancel', onPointerEnd);

  helpForm.addEventListener('submit', event => {
    event.preventDefault();
    event.stopPropagation();
    routeHelpRequest(helpInput.value);
  });
  helpInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    routeHelpRequest(helpInput.value);
  });
  helpInput.addEventListener('input', () => {
    if (helpFeedback.classList.contains('is-error')) {
      helpFeedback.textContent = '';
      helpFeedback.classList.add('hidden');
      helpFeedback.classList.remove('is-error');
    }
  });
  pauseButton.addEventListener('click', () => setPaused(!state.paused));
  hideButton.addEventListener('click', () => setHidden(true));
  restoreButton.addEventListener('click', () => setHidden(false));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && tipOpen()) {
      event.preventDefault();
      closeTip(true);
    }
  });

  let mutationQueued = false;
  const observer = new MutationObserver(() => {
    if (mutationQueued) return;
    mutationQueued = true;
    requestAnimationFrame(() => {
      mutationQueued = false;
      lamp.setAttribute('aria-expanded', tipOpen() ? 'true' : 'false');
      refreshLifecycle({ reposition: true, roamDelay: 2200 });
    });
  });
  // Apenas body e dock controlam login, modal e visibilidade do personagem.
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  observer.observe(dock, { attributes: true, attributeFilter: ['class'] });

  function queueLayout() {
    clearTimeout(state.layoutTimer);
    state.layoutTimer = setTimeout(() => {
      const opened = tipOpen();
      refreshLifecycle({ reposition: !opened });
      if (opened) keepOpenTipVisible();
    }, 140);
  }
  window.addEventListener('resize', queueLayout, { passive: true });
  window.addEventListener('scroll', queueLayout, { passive: true });
  window.visualViewport?.addEventListener('resize', queueLayout, { passive: true });
  window.visualViewport?.addEventListener('scroll', queueLayout, { passive: true });
  document.addEventListener('visibilitychange', () => refreshLifecycle({ reposition: !document.hidden }));
  document.addEventListener('input', event => {
    if (event.target?.matches?.('input, textarea, select, [contenteditable="true"]')) pauseForTyping();
  });
  document.addEventListener('keydown', event => {
    if (event.target?.matches?.('input, textarea, [contenteditable="true"]')) pauseForTyping();
  });
  motionMedia?.addEventListener?.('change', event => {
    state.reduced = event.matches;
    updateControls();
    refreshLifecycle({ reposition: true });
  });

  // Mensagens contextuais podem aparecer como retorno, sem substituir a
  // pergunta fixa "Como posso ajudar?".
  if (typeof window.updateSeguitoAssistant === 'function') {
    const originalUpdateAssistant = window.updateSeguitoAssistant;
    window.updateSeguitoAssistant = function(...args) {
      const result = originalUpdateAssistant.apply(this, args);
      const message = document.getElementById('seguitoAssistantMessage')?.textContent.trim();
      if (message && tipOpen()) showHelpFeedback(message);
      return result;
    };
  }

  window.NestorX = Object.freeze({
    show: () => setHidden(false),
    hide: () => setHidden(true),
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    walk() {
      if (!state.reduced && dockAvailable() && !state.hidden) {
        moveTo(bestAnchor({ forceOtherSide: true }));
        scheduleRoam(7200);
      }
    },
    say(message) {
      showTip();
      if (message) showHelpFeedback(String(message));
    }
  });

  setSide(state.side);
  updateControls();
  requestAnimationFrame(() => {
    moveTo(bestAnchor({ preferredSlot: state.slot }), { immediate: true });
    refreshLifecycle({ roamDelay: 2200 });
  });
})();
