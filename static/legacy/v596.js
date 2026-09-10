'use strict';

/* Versão 5.9.6 — camada de experiência profissional
 *
 * Mantém as regras comerciais existentes e acrescenta apenas uma camada de
 * orientação: resumo da tela inicial, continuidade de rascunhos e feedback
 * discreto de salvamento.
 */
(() => {
  const DRAFT_PREFIX = 'seg_quote_draft_v596:';
  const DRAFT_VERSION = 1;
  let draftTimer = null;

  function draftOwner() {
    const user = currentUser || {};
    return normalize(String(user.username || user.code || user.name || 'guest')) || 'guest';
  }

  function draftKey() { return `${DRAFT_PREFIX}${draftOwner()}`; }

  function quoteHasContent(quote = currentQuote) {
    return Boolean(quote?.items?.length || quote?.client?.name || quote?.client?.document || quote?.notes);
  }

  function readDraft() {
    if (!currentUser) return null;
    try {
      const raw = localStorage.getItem(draftKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== DRAFT_VERSION || !parsed.quote || !Array.isArray(parsed.quote.items)) return null;
      return parsed;
    } catch { return null; }
  }

  function setDraftStatus(label, kind = 'ready') {
    const status = $('quoteDraftStatus');
    if (!status) return;
    status.textContent = label;
    status.classList.remove('is-saving', 'is-saved', 'is-ready', 'is-warning');
    status.classList.add(`is-${kind}`);
  }

  function saveDraftNow() {
    if (!currentUser || currentUser.role === 'client' || !quoteHasContent()) return;
    try {
      if (typeof syncFormToQuote === 'function') syncFormToQuote();
      const payload = { version: DRAFT_VERSION, savedAt: new Date().toISOString(), quote: structuredClone(currentQuote) };
      localStorage.setItem(draftKey(), JSON.stringify(payload));
      setDraftStatus('Rascunho salvo', 'saved');
    } catch {
      setDraftStatus('Salvamento local indisponível', 'warning');
    }
  }

  function scheduleDraftSave() {
    if (!currentUser || currentUser.role === 'client') return;
    setDraftStatus('Salvando…', 'saving');
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraftNow, 450);
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch { /* armazenamento indisponível */ }
    setDraftStatus('Pronto', 'ready');
    updateHomeSummary();
  }

  function recentQuoteCount() {
    try {
      const history = typeof getHistory === 'function' ? getHistory() : [];
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
      return history.filter(item => new Date(item.updatedAt || item.createdAt || 0).getTime() >= cutoff).length;
    } catch { return 0; }
  }

  function updateHomeSummary() {
    const draft = readDraft();
    const draftCount = $('homeDraftCount');
    const todayCount = $('homeTodayCount');
    const connection = $('homeConnectionLabel');
    const resume = $('homeResumeBtn');
    const resumeText = $('homeResumeText');
    if (draftCount) draftCount.textContent = draft ? '1' : '0';
    if (todayCount) todayCount.textContent = String(recentQuoteCount());
    if (connection) {
      const online = navigator.onLine !== false && !$('connectionStatus')?.classList.contains('offline');
      connection.textContent = online ? 'Online' : 'Offline';
      connection.classList.toggle('is-offline', !online);
    }
    if (resume) resume.classList.toggle('hidden', !draft);
    if (resumeText && draft) {
      const quote = draft.quote || {};
      const items = Array.isArray(quote.items) ? quote.items.length : 0;
      const saved = draft.savedAt ? new Date(draft.savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      resumeText.textContent = `${items} ${items === 1 ? 'produto' : 'produtos'}${saved ? ` • salvo às ${saved}` : ''}`;
    }
  }

  function resumeDraft() {
    const draft = readDraft();
    if (!draft) { showToast('Não há rascunho salvo para retomar.'); updateHomeSummary(); return; }
    currentQuote = structuredClone(draft.quote);
    if (typeof populateQuoteForm === 'function') populateQuoteForm();
    if (typeof hideHomeScreen === 'function') hideHomeScreen();
    if (typeof switchPage === 'function') switchPage('quote');
    if (typeof showQuoteStep === 'function') showQuoteStep(1, { scroll: false, focus: false });
    setDraftStatus('Rascunho retomado', 'saved');
    showToast('Rascunho retomado. Você pode continuar de onde parou.');
  }

  function bindExperienceLayer() {
    if ($('homeResumeBtn') && !$('homeResumeBtn').dataset.bound) {
      $('homeResumeBtn').dataset.bound = '1';
      $('homeResumeBtn').addEventListener('click', resumeDraft);
    }
    if (document.body.dataset.v596Bound === '1') return;
    document.body.dataset.v596Bound = '1';
    document.addEventListener('input', event => {
      const id = event.target?.id || '';
      if (!/^((client|register|quote|notes|discount|freight|payment|validity|store|seller))/i.test(id)) return;
      if (id === 'quoteSearchInput' || id === 'catalogSearchInput') return;
      scheduleDraftSave();
    }, true);
    document.addEventListener('change', event => {
      if (event.target?.closest?.('#page-quote')) scheduleDraftSave();
    }, true);
    window.addEventListener('online', updateHomeSummary);
    window.addEventListener('offline', updateHomeSummary);
    window.addEventListener('beforeunload', saveDraftNow);
  }

  const originalRenderCart = renderCart;
  renderCart = function (...args) {
    const result = originalRenderCart.apply(this, args);
    if (currentUser && currentUser.role !== 'client' && quoteHasContent()) scheduleDraftSave();
    updateHomeSummary();
    return result;
  };

  const originalSaveQuote = saveQuote;
  saveQuote = function (...args) {
    const result = originalSaveQuote.apply(this, args);
    if (result) clearDraft();
    updateHomeSummary();
    return result;
  };

  const originalNewQuote = newQuote;
  newQuote = function (...args) {
    const hadContent = quoteHasContent();
    const result = originalNewQuote.apply(this, args);
    if (hadContent && !quoteHasContent()) clearDraft();
    updateHomeSummary();
    return result;
  };

  const originalShowHomeScreen = showHomeScreen;
  showHomeScreen = function (...args) {
    const result = originalShowHomeScreen.apply(this, args);
    updateHomeSummary();
    return result;
  };

  const originalApplyAuthenticatedUser = applyAuthenticatedUser;
  applyAuthenticatedUser = function (...args) {
    const result = originalApplyAuthenticatedUser.apply(this, args);
    setTimeout(() => { updateHomeSummary(); setDraftStatus(readDraft() ? 'Rascunho disponível' : 'Pronto', readDraft() ? 'saved' : 'ready'); }, 80);
    return result;
  };

  bindExperienceLayer();
  updateHomeSummary();
})();
