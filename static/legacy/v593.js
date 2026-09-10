/* SEG Vendas 5.9.5 — avatar clicável, orçamento direto e cesta flutuante */
(function () {
  'use strict';

  const STAFF_ROLES = new Set(['seller', 'coordinator', 'admin']);
  const BASKET_PAGES = new Set(['quote', 'products', 'assistant']);
  const SEARCH_PAGE_SIZES = [8, 16, 24, 32, 40, 50];
  const PRODUCT_CATEGORY_DEFAULTS = [
    'Automatizadores', 'CFTV', 'Controle de acesso', 'Alarmes e sensores',
    'Fontes e energia', 'Redes e conectividade', 'Cabos e conectores',
    'Interfonia e fechaduras', 'Ferramentas e acessórios', 'Outros'
  ];
  const SEARCH_ALIASES = Object.freeze({
    dz: ['deslizante', 'deslizantes', 'motor', 'portao'],
    deslisante: ['deslizante'],
    deslisantes: ['deslizantes', 'deslizante'],
    deslizante: ['deslizante', 'deslizantes'],
    portao: ['portao', 'automatizador'],
    portoes: ['portao', 'automatizador'],
    camera: ['camera', 'cftv'],
    cameras: ['camera', 'cftv'],
    fonte: ['fonte', 'energia'],
    fontes: ['fonte', 'energia']
  });
  const ASSISTANT_NAMES = Object.freeze({
    nestorx: { subject: 'O NestorX', inlineSubject: 'o NestorX', possessive: 'do NestorX' },
    seguito: { subject: 'O SEGuito', inlineSubject: 'o SEGuito', possessive: 'do SEGuito' },
    pretinha: { subject: 'A Pretinha', inlineSubject: 'a Pretinha', possessive: 'da Pretinha' }
  });
  let basketReady = false;
  let lastQuantities = new Map();
  let peekTimer = 0;
  let clampFrame = 0;
  const searchTimers = { quote: 0, catalog: 0 };
  let basketOwner = '';
  const searchPreferences = {
    quote: { pageSize: 8, page: 1, hidden: false, category: '' },
    catalog: { pageSize: 8, page: 1, hidden: false, category: '' }
  };
  const categoryState = { categories: [...PRODUCT_CATEGORY_DEFAULTS], overrides: {}, loaded: false };

  function basketElements() {
    return {
      root: document.getElementById('floatingBasket'),
      toggle: document.getElementById('floatingBasketToggle'),
      panel: document.getElementById('floatingBasketPanel'),
      close: document.getElementById('floatingBasketClose'),
      count: document.getElementById('floatingBasketCount'),
      meta: document.getElementById('floatingBasketMeta'),
      summary: document.getElementById('floatingBasketSummary'),
      list: document.getElementById('floatingBasketList'),
      subtotal: document.getElementById('floatingBasketSubtotal'),
      openQuote: document.getElementById('floatingBasketOpenQuote'),
      clear: document.getElementById('floatingBasketClear'),
      peek: document.getElementById('floatingBasketPeek')
    };
  }

  function activeAssistant() {
    const key = document.getElementById('nestorxMover')?.dataset.avatar || 'nestorx';
    return ASSISTANT_NAMES[key] || ASSISTANT_NAMES.nestorx;
  }

  function syncBasketAssistantName() {
    const { root, panel, toggle } = basketElements();
    const assistant = activeAssistant();
    root?.setAttribute('aria-label', `Pensamento ${assistant.possessive} sobre a cesta`);
    panel?.setAttribute('aria-label', `Produtos que ${assistant.inlineSubject} está conferindo`);
    toggle?.setAttribute('aria-label', `Abrir pensamento ${assistant.possessive} com os produtos`);
    const title = panel?.querySelector('.floating-basket-head strong');
    if (title) title.textContent = `${assistant.subject} está conferindo…`;
  }

  function quoteItems() {
    return Array.isArray(currentQuote?.items) ? currentQuote.items : [];
  }

  function currentOwner() {
    return String(currentUser?.username || currentUser?.code || '').trim().toLocaleLowerCase('pt-BR');
  }

  function snapshotCurrentBasketOwner() {
    const owner = currentOwner();
    if (!basketOwner) {
      basketOwner = owner;
      return;
    }
    if (owner === basketOwner) return;
    if (currentQuote) currentQuote.items = [];
    basketOwner = owner;
    basketReady = false;
    lastQuantities = new Map();
  }

  function activePage() {
    return document.querySelector('.page.active')?.id.replace('page-', '') || '';
  }

  function formatQuantity(value) {
    const quantity = Math.max(0, Number(value) || 0);
    return quantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function basketTotals() {
    const items = quoteItems();
    return {
      products: items.length,
      quantity: items.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0),
      subtotal: items.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0) * Math.max(0, Number(item.unitPrice) || 0), 0)
    };
  }

  function canShowBasket() {
    return Boolean(
      currentUser
      && STAFF_ROLES.has(currentUser.role)
      && BASKET_PAGES.has(activePage())
      && !document.body.classList.contains('auth-locked')
    );
  }

  function searchElements(mode) {
    const quoteMode = mode === 'quote';
    return {
      input: document.getElementById(quoteMode ? 'quoteSearchInput' : 'catalogSearchInput'),
      clear: document.getElementById(quoteMode ? 'quoteSearchClear' : 'catalogSearchClear'),
      results: document.getElementById(quoteMode ? 'quoteSearchResults' : 'catalogResults'),
      select: document.getElementById(quoteMode ? 'quoteSearchLimit' : 'catalogSearchLimit'),
      visibility: document.getElementById(quoteMode ? 'quoteSearchVisibility' : 'catalogSearchVisibility'),
      category: document.getElementById(quoteMode ? 'quoteSearchCategory' : 'catalogSearchCategory'),
      pagination: document.getElementById(quoteMode ? 'quoteSearchPagination' : 'catalogSearchPagination')
    };
  }

  function categoryForProduct(product) {
    const override = categoryState.overrides[String(product?.code || '')]?.category;
    if (override) return override;
    const text = normalize(product?.desc || '');
    if (/camera|dvr|nvr|cftv|bullet|speed dome|lente|gravador|hd\b/.test(text)) return 'CFTV';
    if (/motor|deslizante|basculante|portao|automatizador|central de comando|cremalheira/.test(text)) return 'Automatizadores';
    if (/alarme|sensor|sirene|infravermelho|magnetico|cerca eletrica/.test(text)) return 'Alarmes e sensores';
    if (/controle de acesso|controlador|catraca|biometr|cartao|tag|leitor|fechadura/.test(text)) return 'Controle de acesso';
    if (/interfone|video porteiro|porteiro|fecho|eletroima/.test(text)) return 'Interfonia e fechaduras';
    if (/fonte|nobreak|bateria|carregador|transformador|energia/.test(text)) return 'Fontes e energia';
    if (/cabo|conector|plug|balun|adaptador|patch cord|fibra/.test(text)) return 'Cabos e conectores';
    if (/switch|roteador|router|antena|wifi|wireless|rede|rack|poe/.test(text)) return 'Redes e conectividade';
    if (/ferramenta|alicate|chave|parafuso|suporte|caixa|organizador|protetor/.test(text)) return 'Ferramentas e acessórios';
    return 'Outros';
  }

  function refreshProductCategories() {
    const categories = [...PRODUCT_CATEGORY_DEFAULTS, ...(categoryState.categories || [])]
      .map(value => String(value || '').trim())
      .filter((value, index, values) => value && values.findIndex(item => item.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR')) === index);
    categoryState.categories = categories;
    productIndex.forEach(product => {
      product.category = categoryForProduct(product);
      product.categoryNorm = normalize(product.category);
      product.aliases = `${product.category} ${product.desc}`;
    });
  }

  function levenshtein(left, right) {
    const a = String(left || ''), b = String(right || '');
    if (!a) return b.length;
    if (!b) return a.length;
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      for (let j = 1; j <= b.length; j += 1) {
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      previous = current;
    }
    return previous[b.length];
  }

  function smartProductSearch(query, limit = 300) {
    const raw = String(query || '').trim();
    const normalized = normalize(raw);
    if (normalized.length < 2) return [];
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const expanded = tokens.flatMap(token => [token, ...(SEARCH_ALIASES[token] || [])]);
    const exactCode = raw.replace(/\D/g, '');
    const numericOnly = /^\d+$/.test(normalized);
    const scored = [];
    for (const product of productIndex) {
      // Um código digitado sozinho deve localizar o código, não sugerir
      // centenas de outros códigos apenas por distância de edição.
      if (numericOnly && !(exactCode && (product.code === exactCode || product.code.startsWith(exactCode)))) continue;
      const haystack = normalize(`${product.code} ${product.desc} ${product.category || ''} ${product.aliases || ''}`);
      const words = [...new Set(haystack.split(/\s+/).filter(word => word.length > 1))];
      let score = 0;
      if (exactCode && product.code === exactCode) score += 3000;
      else if (exactCode && product.code.startsWith(exactCode)) score += 1300;
      if (haystack.includes(normalized)) score += 900;
      for (const token of tokens) {
        if (haystack.includes(token)) { score += 260; continue; }
        const aliases = SEARCH_ALIASES[token] || [];
        if (aliases.some(alias => haystack.includes(alias))) { score += 230; continue; }
        let best = 0;
        for (const word of words) {
          if (Math.abs(word.length - token.length) > Math.max(2, Math.floor(token.length * .45))) continue;
          const distance = levenshtein(token, word);
          const similarity = 1 - distance / Math.max(token.length, word.length);
          if (similarity > best) best = similarity;
        }
        if (best >= (token.length <= 4 ? .66 : .58)) score += Math.round(best * 180);
        else { score = 0; break; }
      }
      if (score) scored.push({ score, product });
    }
    scored.sort((a, b) => b.score - a.score || a.product.desc.localeCompare(b.product.desc, 'pt-BR'));
    return scored.slice(0, Math.max(1, Number(limit) || 300)).map(item => item.product);
  }

  async function loadProductCategories(force = false) {
    if (!currentUser || (categoryState.loaded && !force)) return;
    try {
      const response = await apiFetch('/api/product-categories', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Categorias indisponíveis');
      categoryState.categories = Array.isArray(data.categories) ? data.categories : [...PRODUCT_CATEGORY_DEFAULTS];
      categoryState.overrides = data.overrides && typeof data.overrides === 'object' ? data.overrides : {};
      categoryState.loaded = true;
      refreshProductCategories();
      renderCategoryAdmin();
    } catch (error) {
      refreshProductCategories();
      if (currentUser?.role === 'admin') showToast(error.message || 'Não foi possível carregar categorias');
    }
  }

  function searchPreferenceKey(mode) {
    return `seg_product_search_${mode}_v593`;
  }

  function loadSearchPreference(mode) {
    try {
      const saved = JSON.parse(localStorage.getItem(searchPreferenceKey(mode)) || '{}');
      const legacy = Number(saved.limit);
      const pageSize = SEARCH_PAGE_SIZES.includes(Number(saved.pageSize)) ? Number(saved.pageSize) : (SEARCH_PAGE_SIZES.includes(legacy) ? legacy : 8);
      searchPreferences[mode] = { pageSize, page: 1, hidden: Boolean(saved.hidden), category: String(saved.category || '') };
    } catch {
      searchPreferences[mode] = { pageSize: 8, page: 1, hidden: false, category: '' };
    }
  }

  function saveSearchPreference(mode) {
    try { localStorage.setItem(searchPreferenceKey(mode), JSON.stringify(searchPreferences[mode])); } catch { /* indisponível */ }
  }

  function updateSearchVisibility(mode) {
    const elements = searchElements(mode);
    const preference = searchPreferences[mode];
    const hasQuery = normalize(elements.input?.value || '').length >= 2;
    const hidden = hasQuery && preference.hidden;
    elements.results?.classList.toggle('product-results-collapsed', hidden);
    if (elements.visibility) {
      elements.visibility.textContent = hidden ? 'Mostrar resultados' : 'Ocultar resultados';
      elements.visibility.disabled = !hasQuery;
      elements.visibility.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    }
  }

  function ensureSearchControls(mode) {
    const elements = searchElements(mode);
    const host = elements.select?.closest('.product-search-options');
    if (!host) return elements;
    if (!elements.category) {
      const label = document.createElement('label');
      label.textContent = 'Categoria';
      const select = document.createElement('select');
      select.id = mode === 'quote' ? 'quoteSearchCategory' : 'catalogSearchCategory';
      select.setAttribute('aria-label', 'Filtrar produtos por categoria');
      label.appendChild(select);
      host.insertBefore(label, host.firstElementChild);
    }
    if (!elements.pagination) {
      const nav = document.createElement('nav');
      nav.id = mode === 'quote' ? 'quoteSearchPagination' : 'catalogSearchPagination';
      nav.className = 'product-search-pagination hidden';
      nav.setAttribute('aria-label', 'Paginação dos produtos encontrados');
      elements.results?.insertAdjacentElement('afterend', nav);
    }
    return searchElements(mode);
  }

  function renderCategoryOptions(mode) {
    const elements = ensureSearchControls(mode);
    if (!elements.category) return;
    const selected = searchPreferences[mode].category || '';
    elements.category.innerHTML = `<option value="">Todas as categorias</option>${categoryState.categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}`;
    elements.category.value = categoryState.categories.includes(selected) ? selected : '';
  }

  function renderSearchPagination(mode, total, pageSize, page) {
    const elements = searchElements(mode);
    const nav = elements.pagination;
    if (!nav) return;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (total <= pageSize) {
      nav.className = 'product-search-pagination hidden';
      nav.innerHTML = '';
      return;
    }
    const safePage = Math.min(pages, Math.max(1, page));
    nav.className = 'product-search-pagination';
    nav.innerHTML = `<button type="button" class="btn ghost compact-btn" data-product-page="${safePage - 1}" ${safePage <= 1 ? 'disabled' : ''}>← Anterior</button><span>Página <strong>${safePage}</strong> de ${pages}</span><button type="button" class="btn ghost compact-btn" data-product-page="${safePage + 1}" ${safePage >= pages ? 'disabled' : ''}>Próxima →</button>`;
    nav.querySelectorAll('[data-product-page]').forEach(button => button.addEventListener('click', () => {
      searchPreferences[mode].page = Math.min(pages, Math.max(1, Number(button.dataset.productPage) || 1));
      saveSearchPreference(mode);
      renderSearch(mode === 'quote' ? 'quoteSearchInput' : 'catalogSearchInput', mode === 'quote' ? 'quoteSearchClear' : 'catalogSearchClear', mode === 'quote' ? 'quoteSearchResults' : 'catalogResults', mode);
      elements.results?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }));
  }

  function renderLimitedSearch(inputId, clearId, resultsId, mode) {
    const elements = ensureSearchControls(mode);
    renderCategoryOptions(mode);
    const input = document.getElementById(inputId);
    const clear = document.getElementById(clearId);
    const results = document.getElementById(resultsId);
    const query = input?.value.trim() || '';
    clear?.classList.toggle('hidden', !query);
    if (normalize(query).length < 2) {
      results.className = mode === 'catalog' ? 'catalog-results empty-state' : 'search-results empty-state compact';
      results.textContent = 'Digite ao menos 2 caracteres para pesquisar.';
      searchPreferences[mode].hidden = false;
      searchPreferences[mode].page = 1;
      renderSearchPagination(mode, 0, searchPreferences[mode].pageSize, 1);
      updateSearchVisibility(mode);
      return;
    }
    const pageSize = searchPreferences[mode].pageSize;
    let allFound = searchProducts(query, productIndex.length);
    const category = searchPreferences[mode].category;
    if (category) allFound = allFound.filter(product => categoryForProduct(product) === category);
    const pages = Math.max(1, Math.ceil(allFound.length / pageSize));
    searchPreferences[mode].page = Math.min(pages, Math.max(1, searchPreferences[mode].page || 1));
    const start = (searchPreferences[mode].page - 1) * pageSize;
    const found = allFound.slice(start, start + pageSize);
    results.className = mode === 'catalog' ? 'catalog-results' : 'search-results';
    if (!found.length) {
      results.classList.add('empty-state');
      results.textContent = 'Nenhum produto encontrado.';
      renderSearchPagination(mode, 0, pageSize, 1);
      updateSearchVisibility(mode);
      return;
    }
    results.innerHTML = found.map(product => productCard(product, mode)).join('');
    if (allFound.length > pageSize) {
      results.insertAdjacentHTML('beforeend', `<p class="product-search-more">Mostrando ${start + 1}–${Math.min(start + found.length, allFound.length)} de ${allFound.length} encontrados.</p>`);
    }
    results.querySelectorAll('[data-product-index]').forEach(button => {
      button.addEventListener('click', () => addProduct(Number(button.dataset.productIndex)));
    });
    results.querySelectorAll('[data-sales-product-index]').forEach(button => {
      button.addEventListener('click', () => openSalesContact(Number(button.dataset.salesProductIndex)));
    });
    bindProductMediaEvents(results);
    hydrateProductPhotos(results);
    updateProductButtons();
    renderSearchPagination(mode, allFound.length, pageSize, searchPreferences[mode].page);
    updateSearchVisibility(mode);
  }

  function bindSearchControls() {
    ['quote', 'catalog'].forEach(mode => {
      loadSearchPreference(mode);
      const elements = ensureSearchControls(mode);
      if (!elements.select || !elements.visibility) return;
      renderCategoryOptions(mode);
      elements.select.value = String(searchPreferences[mode].pageSize);
      elements.input?.addEventListener('input', event => {
        event.stopImmediatePropagation();
        debounceProductSearch(mode);
      }, true);
      elements.select.addEventListener('change', () => {
        searchPreferences[mode].pageSize = SEARCH_PAGE_SIZES.includes(Number(elements.select.value)) ? Number(elements.select.value) : 8;
        searchPreferences[mode].page = 1;
        searchPreferences[mode].hidden = false;
        saveSearchPreference(mode);
        if (mode === 'quote') renderSearch('quoteSearchInput', 'quoteSearchClear', 'quoteSearchResults', 'quote');
        else renderSearch('catalogSearchInput', 'catalogSearchClear', 'catalogResults', 'catalog');
      });
      elements.category?.addEventListener('change', () => {
        searchPreferences[mode].category = elements.category.value;
        searchPreferences[mode].page = 1;
        saveSearchPreference(mode);
        if (mode === 'quote') renderSearch('quoteSearchInput', 'quoteSearchClear', 'quoteSearchResults', 'quote');
        else renderSearch('catalogSearchInput', 'catalogSearchClear', 'catalogResults', 'catalog');
      });
      elements.visibility.addEventListener('click', () => {
        if (normalize(elements.input?.value || '').length < 2) return;
        searchPreferences[mode].hidden = !searchPreferences[mode].hidden;
        saveSearchPreference(mode);
        updateSearchVisibility(mode);
      });
      updateSearchVisibility(mode);
    });
  }

  function debounceProductSearch(mode) {
    const dock = document.getElementById('seguitoDock');
    dock?.classList.add('basket-search-typing');
    window.clearTimeout(searchTimers.pause);
    searchTimers.pause = window.setTimeout(() => dock?.classList.remove('basket-search-typing'), 1600);
    window.clearTimeout(searchTimers[mode]);
    searchTimers[mode] = window.setTimeout(() => {
      if (mode === 'quote') {
        renderSearch('quoteSearchInput', 'quoteSearchClear', 'quoteSearchResults', 'quote');
        const query = document.getElementById('quoteSearchInput')?.value.trim();
        if (query?.length >= 2) updateSeguitoAssistant(query);
      } else {
        renderSearch('catalogSearchInput', 'catalogSearchClear', 'catalogResults', 'catalog');
      }
    }, 180);
  }

  function closeBasket() {
    const { panel, toggle } = basketElements();
    panel?.classList.add('hidden');
    toggle?.setAttribute('aria-expanded', 'false');
    document.getElementById('seguitoDock')?.classList.remove('basket-thought-open');
  }

  function openBasket() {
    const { panel, toggle, peek } = basketElements();
    if (!panel || !toggle) return;
    const tip = document.getElementById('seguitoTip');
    if (tip && !tip.classList.contains('hidden')) document.getElementById('closeSeguitoTip')?.click();
    peek?.classList.add('hidden');
    document.getElementById('seguitoDock')?.classList.add('basket-thought-open');
    panel.classList.remove('hidden');
    toggle.setAttribute('aria-expanded', 'true');
    clampBasketPanel();
    panel.querySelector('button, input')?.focus({ preventScroll: true });
  }

  function toggleBasket() {
    const { panel } = basketElements();
    if (!panel) return;
    if (panel.classList.contains('hidden')) openBasket();
    else closeBasket();
  }

  function showBasketPeek(item) {
    const { panel, peek, root } = basketElements();
    if (!peek || !root || !panel?.classList.contains('hidden') || root.classList.contains('hidden')) return;
    const quantity = Math.max(0, Number(item?.qty) || 0);
    peek.innerHTML = `<strong>💭 ${activeAssistant().subject} está conferindo</strong><span>Cód. ${escapeHtml(item?.code || '')} · ${escapeHtml(formatQuantity(quantity))} ${quantity === 1 ? 'unidade' : 'unidades'}</span>`;
    peek.classList.remove('hidden');
    window.clearTimeout(peekTimer);
    peekTimer = window.setTimeout(() => peek.classList.add('hidden'), 2600);
  }

  function detectAddedItem(items) {
    let increased = null;
    for (const item of items) {
      const code = String(item.code || '');
      const quantity = Math.max(0, Number(item.qty) || 0);
      if (basketReady && quantity > (lastQuantities.get(code) || 0)) increased = item;
    }
    lastQuantities = new Map(items.map(item => [String(item.code || ''), Math.max(0, Number(item.qty) || 0)]));
    basketReady = true;
    return increased;
  }

  function updateProductButtons() {
    const quantities = new Map(quoteItems().map(item => [String(item.code), Math.max(0, Number(item.qty) || 0)]));
    document.querySelectorAll('[data-product-index], [data-chat-product]').forEach(button => {
      const rawIndex = button.dataset.productIndex ?? button.dataset.chatProduct;
      const product = productIndex.find(entry => entry.i === Number(rawIndex));
      const quantity = quantities.get(String(product?.code || '')) || 0;
      button.classList.toggle('in-floating-basket', quantity > 0);
      if (quantity > 0) {
        button.dataset.basketQuantity = formatQuantity(quantity);
        button.title = `${formatQuantity(quantity)} na cesta`;
      } else {
        delete button.dataset.basketQuantity;
        if (button.title?.includes('na cesta')) button.removeAttribute('title');
      }
    });
  }

  function renderFloatingBasket({ announceAddition = true } = {}) {
    const elements = basketElements();
    if (!elements.root || !elements.list) return;
    snapshotCurrentBasketOwner();
    const items = quoteItems();
    const totals = basketTotals();
    const increased = detectAddedItem(items);
    const visible = canShowBasket();
    elements.root.classList.toggle('hidden', !visible);
    if (!visible) closeBasket();
    syncBasketAssistantName();
    positionBasketThought();

    elements.count.textContent = formatQuantity(totals.quantity);
    elements.meta.textContent = totals.products === 1 ? '1 produto' : `${totals.products} produtos`;
    elements.summary.textContent = totals.products
      ? `${totals.products} ${totals.products === 1 ? 'produto' : 'produtos'} · ${formatQuantity(totals.quantity)} ${totals.quantity === 1 ? 'unidade' : 'unidades'}`
      : 'Nenhum produto adicionado';
    elements.subtotal.textContent = money.format(totals.subtotal);
    elements.clear.disabled = !items.length;
    elements.openQuote.disabled = !items.length;

    if (!items.length) {
      elements.list.className = 'floating-basket-list empty';
      elements.list.innerHTML = '<p>Use o botão <strong>Adicionar</strong> ou <strong>+</strong> nos produtos. Eles aparecerão aqui.</p>';
    } else {
      elements.list.className = 'floating-basket-list';
      elements.list.innerHTML = items.map((item, index) => `
        <article class="floating-basket-item">
          <div class="floating-basket-item-copy">
            <span>CÓD. ${escapeHtml(item.code)}</span>
            <strong>${escapeHtml(item.description)}</strong>
            <small>${money.format(Number(item.unitPrice) || 0)} cada · ${money.format((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}</small>
          </div>
          <div class="floating-basket-quantity" aria-label="Quantidade de ${escapeHtml(item.description)}">
            <button type="button" data-floating-decrease="${index}" aria-label="Diminuir uma unidade">−</button>
            <input type="number" min="0.01" step="0.01" inputmode="decimal" value="${escapeHtml(Number(item.qty) || 0)}" data-floating-quantity="${index}" aria-label="Quantidade">
            <button type="button" data-floating-increase="${index}" aria-label="Adicionar uma unidade">+</button>
          </div>
          <button class="floating-basket-remove" type="button" data-floating-remove="${index}" aria-label="Remover ${escapeHtml(item.description)} da cesta" title="Remover">×</button>
        </article>`).join('');

      elements.list.querySelectorAll('[data-floating-increase]').forEach(button => button.addEventListener('click', () => {
        const item = currentQuote.items[Number(button.dataset.floatingIncrease)];
        if (!item) return;
        item.qty = Math.max(0.01, (Number(item.qty) || 0) + 1);
        renderCart();
      }));
      elements.list.querySelectorAll('[data-floating-decrease]').forEach(button => button.addEventListener('click', () => {
        const item = currentQuote.items[Number(button.dataset.floatingDecrease)];
        if (!item) return;
        const quantity = Math.max(0.01, Number(item.qty) || 0.01);
        if (quantity <= 1) {
          showToast('Use × para remover este produto da cesta');
          return;
        }
        item.qty = Math.max(0.01, quantity - 1);
        if (Array.isArray(item.warrantySeals)) item.warrantySeals = item.warrantySeals.slice(0, warrantySealSlots(item));
        renderCart();
      }));
      elements.list.querySelectorAll('[data-floating-quantity]').forEach(input => input.addEventListener('change', () => {
        const item = currentQuote.items[Number(input.dataset.floatingQuantity)];
        if (!item) return;
        const quantity = Math.max(0.01, parseBR(input.value));
        item.qty = Number.isFinite(quantity) ? quantity : 1;
        if (Array.isArray(item.warrantySeals)) item.warrantySeals = item.warrantySeals.slice(0, warrantySealSlots(item));
        renderCart();
      }));
      elements.list.querySelectorAll('[data-floating-remove]').forEach(button => button.addEventListener('click', () => {
        currentQuote.items.splice(Number(button.dataset.floatingRemove), 1);
        renderCart();
      }));
    }

    updateProductButtons();
    if (announceAddition && increased) {
      elements.toggle.classList.remove('just-added');
      void elements.toggle.offsetWidth;
      elements.toggle.classList.add('just-added');
      window.setTimeout(() => elements.toggle.classList.remove('just-added'), 620);
      showBasketPeek(increased);
    }
  }

  function positionBasketThought() {
    const { root } = basketElements();
    const mover = document.getElementById('nestorxMover');
    if (!root || !mover) return;
    if (root.parentElement !== mover) mover.appendChild(root);
    root.style.removeProperty('left');
    root.style.removeProperty('right');
    root.style.removeProperty('top');
    root.style.removeProperty('bottom');
    clampBasketPanel();
  }

  function clampBasketPanel() {
    const { root, panel } = basketElements();
    if (!root || !panel) return;
    const viewportWidth = window.visualViewport?.width || document.documentElement.clientWidth || window.innerWidth;
    root.style.setProperty('--basket-panel-available-width', `${Math.max(0, Math.floor(viewportWidth - 16))}px`);
    if (panel.classList.contains('hidden')) return;
    window.cancelAnimationFrame(clampFrame);
    clampFrame = window.requestAnimationFrame(() => {
      root.style.setProperty('--basket-panel-max-height', 'none');
      root.style.setProperty('--basket-panel-shift-x', '0px');
      const rect = panel.getBoundingClientRect();
      const toggleRect = basketElements().toggle?.getBoundingClientRect();
      const viewportLeft = window.visualViewport?.offsetLeft || 0;
      const viewportRight = viewportLeft + (window.visualViewport?.width || document.documentElement.clientWidth || window.innerWidth);
      const viewportTop = window.visualViewport?.offsetTop || 0;
      const viewportBottom = viewportTop + (window.visualViewport?.height || document.documentElement.clientHeight || window.innerHeight);
      const margin = 8;
      let shift = 0;
      if (rect.left < viewportLeft + margin) shift += viewportLeft + margin - rect.left;
      if (rect.right + shift > viewportRight - margin) shift -= (rect.right + shift) - (viewportRight - margin);
      root.style.setProperty('--basket-panel-shift-x', `${Math.round(shift)}px`);
      if (toggleRect) {
        const upperHalf = !document.getElementById('nestorxMover')?.classList.contains('is-lower-half');
        const availableHeight = upperHalf
          ? viewportBottom - toggleRect.bottom - margin
          : toggleRect.top - viewportTop - margin;
        root.style.setProperty('--basket-panel-max-height', `${Math.max(130, Math.floor(availableHeight))}px`);
        root.style.setProperty('--basket-list-max-height', `${Math.max(48, Math.floor(availableHeight - 170))}px`);
      }
    });
  }

  function openQuoteItems() {
    closeBasket();
    hideHomeScreen();
    switchPage('quote');
    showQuoteStep(3, { scroll: false, focus: false });
    const panel = document.querySelector('[data-quote-step-panel="3"]');
    window.requestAnimationFrame(() => {
      if (!panel) return;
      const top = Math.max(0, panel.getBoundingClientRect().top + window.scrollY - 92);
      window.scrollTo({ top, behavior: 'smooth' });
      panel.querySelector('input, select, textarea, button')?.focus({ preventScroll: true });
    });
  }

  function bindFloatingBasket() {
    const elements = basketElements();
    if (!elements.root || elements.root.dataset.bound === '1') return;
    elements.root.dataset.bound = '1';
    elements.toggle.addEventListener('click', toggleBasket);
    elements.close.addEventListener('click', closeBasket);
    elements.openQuote.addEventListener('click', openQuoteItems);
    elements.clear.addEventListener('click', () => {
      if (!quoteItems().length) return;
      if (window.confirm('Remover todos os produtos da cesta?')) {
        currentQuote.items = [];
        renderCart();
      }
    });
    document.addEventListener('pointerdown', event => {
      if (event.target.closest?.('#seguitoDockButton, #seguitoTip')) return;
      if (!elements.panel.classList.contains('hidden') && !elements.root.contains(event.target)) closeBasket();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !elements.panel.classList.contains('hidden')) {
        closeBasket();
        elements.toggle.focus();
      }
    });
    const mover = document.getElementById('nestorxMover');
    if (mover) positionBasketThought();
    const handleViewportChange = () => {
      syncBasketAssistantName();
      clampBasketPanel();
    };
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.visualViewport?.addEventListener('resize', handleViewportChange, { passive: true });
  }

  function categoryAdminElements() {
    return {
      card: document.getElementById('productCategoryAdminCard'),
      product: document.getElementById('productCategoryProductInput'),
      options: document.getElementById('productCategoryProductOptions'),
      category: document.getElementById('productCategorySelect'),
      save: document.getElementById('saveProductCategoryBtn'),
      newCategory: document.getElementById('newProductCategoryInput'),
      create: document.getElementById('createProductCategoryBtn'),
      status: document.getElementById('productCategoryStatus')
    };
  }

  function renderCategoryAdmin() {
    const elements = categoryAdminElements();
    if (!elements.card) return;
    elements.category.innerHTML = categoryState.categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    const query = normalize(elements.product?.value || '');
    const matches = query.length >= 2 ? smartProductSearch(query, 30) : productIndex.slice(0, 30);
    if (elements.options) elements.options.innerHTML = matches.map(product => `<option value="${escapeHtml(product.code)}">${escapeHtml(product.desc)} — ${escapeHtml(product.category || categoryForProduct(product))}</option>`).join('');
    const product = resolveCategoryProduct(elements.product?.value || '');
    if (product && elements.category) elements.category.value = categoryForProduct(product);
    if (elements.status && !elements.status.dataset.busy) elements.status.textContent = currentUser?.role === 'admin'
      ? 'Selecione um produto pelo código ou descrição e escolha a categoria.'
      : 'A edição de categorias é exclusiva de administradores.';
  }

  function resolveCategoryProduct(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const exact = productIndex.find(product => product.code === raw);
    return exact || smartProductSearch(raw, 1)[0] || null;
  }

  async function saveProductCategory() {
    const elements = categoryAdminElements();
    const product = resolveCategoryProduct(elements.product?.value || '');
    if (!product) { elements.status.textContent = 'Informe um código ou descrição encontrada no catálogo.'; return; }
    elements.status.dataset.busy = '1';
    elements.save.disabled = true;
    try {
      const response = await apiFetch('/api/product-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set', code: product.code, category: elements.category.value }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível salvar a categoria.');
      categoryState.categories = data.categories || categoryState.categories;
      categoryState.overrides = data.overrides || categoryState.overrides;
      refreshProductCategories();
      elements.status.textContent = `Categoria do produto ${product.code} salva como “${categoryForProduct(product)}”.`;
      renderCategoryAdmin();
      renderVisibleSearches();
    } catch (error) {
      elements.status.textContent = error.message || 'Não foi possível salvar a categoria.';
    } finally {
      delete elements.status.dataset.busy;
      elements.save.disabled = false;
    }
  }

  async function createProductCategory() {
    const elements = categoryAdminElements();
    const category = String(elements.newCategory?.value || '').trim();
    if (category.length < 2) { elements.status.textContent = 'Informe um nome de categoria.'; return; }
    elements.create.disabled = true;
    try {
      const response = await apiFetch('/api/product-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', category }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível criar a categoria.');
      categoryState.categories = data.categories || categoryState.categories;
      refreshProductCategories();
      elements.newCategory.value = '';
      elements.status.textContent = `Categoria “${category}” criada.`;
      renderCategoryAdmin();
    } catch (error) {
      elements.status.textContent = error.message || 'Não foi possível criar a categoria.';
    } finally {
      elements.create.disabled = false;
    }
  }

  function bindCategoryAdmin() {
    const elements = categoryAdminElements();
    if (!elements.card || elements.card.dataset.bound === '1') return;
    elements.card.dataset.bound = '1';
    elements.product?.addEventListener('input', renderCategoryAdmin);
    elements.product?.addEventListener('change', renderCategoryAdmin);
    elements.save?.addEventListener('click', saveProductCategory);
    elements.create?.addEventListener('click', createProductCategory);
    renderCategoryAdmin();
  }

  function renderVisibleSearches() {
    if (document.getElementById('quoteSearchInput')?.value.trim()) renderSearch('quoteSearchInput', 'quoteSearchClear', 'quoteSearchResults', 'quote');
    if (document.getElementById('catalogSearchInput')?.value.trim()) renderSearch('catalogSearchInput', 'catalogSearchClear', 'catalogResults', 'catalog');
  }

  refreshProductCategories();
  searchProducts = function (query, limit = 300) {
    return smartProductSearch(query, limit);
  };
  const originalProductCard = productCard;
  productCard = function (product, mode = 'quote') {
    const category = categoryForProduct(product);
    return originalProductCard(product, mode).replace('<div class="product-desc">', `<span class="product-category-tag">${escapeHtml(category)}</span><div class="product-desc">`);
  };

  const originalRenderCart = renderCart;
  renderCart = function (...args) {
    const result = originalRenderCart.apply(this, args);
    renderFloatingBasket();
    return result;
  };

  const originalRenderSearch = renderSearch;
  renderSearch = function (inputId, clearId, resultsId, mode) {
    if (mode === 'quote' || mode === 'catalog') return renderLimitedSearch(inputId, clearId, resultsId, mode);
    const result = originalRenderSearch.call(this, inputId, clearId, resultsId, mode);
    updateProductButtons();
    return result;
  };

  const originalSwitchPage = switchPage;
  switchPage = function (...args) {
    const result = originalSwitchPage.apply(this, args);
    renderFloatingBasket({ announceAddition: false });
    if (activePage() === 'settings') {
      bindCategoryAdmin();
      renderCategoryAdmin();
    }
    return result;
  };

  const originalHideHomeScreen = hideHomeScreen;
  hideHomeScreen = function (...args) {
    const result = originalHideHomeScreen.apply(this, args);
    renderFloatingBasket({ announceAddition: false });
    return result;
  };

  const originalShowHomeScreen = showHomeScreen;
  showHomeScreen = function (...args) {
    const result = originalShowHomeScreen.apply(this, args);
    renderFloatingBasket({ announceAddition: false });
    return result;
  };

  const originalShowLoginScreen = showLoginScreen;
  showLoginScreen = function (...args) {
    const result = originalShowLoginScreen.apply(this, args);
    renderFloatingBasket({ announceAddition: false });
    return result;
  };

  const originalApplyAuthenticatedUser = applyAuthenticatedUser;
  applyAuthenticatedUser = function (...args) {
    const result = originalApplyAuthenticatedUser.apply(this, args);
    loadProductCategories(true);
    bindCategoryAdmin();
    return result;
  };

  bindFloatingBasket();
  bindSearchControls();
  bindCategoryAdmin();
  loadProductCategories();
  renderFloatingBasket({ announceAddition: false });
})();
