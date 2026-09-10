'use strict';

(() => {
  let productStatuses = {};
  let quoteTemplates = [];
  let templateSourceQuote = null;
  let statusesLoaded = false;
  let templatesLoaded = false;

  const staffRoles = new Set(['seller', 'coordinator', 'admin']);
  const managerRoles = new Set(['coordinator', 'admin']);
  const productByCode = code => productIndex.find(product => product.code === String(code));
  const statusFor = code => productStatuses[String(code)] || null;
  const productIsInactive = product => statusFor(product?.code)?.active === false;
  const canManageProducts = () => managerRoles.has(currentUser?.role || '');

  function installQuoteTemplates() {
    const titleRow = document.querySelector('#page-quote .page-title-row');
    const badge = document.getElementById('quoteNumberBadge');
    if (!titleRow || !badge || document.getElementById('openQuoteTemplatesBtn')) return;
    const actions = document.createElement('div');
    actions.className = 'quote-title-actions';
    actions.innerHTML = '<button class="btn secondary quote-templates-open" id="openQuoteTemplatesBtn" type="button">Pedidos modelos</button>';
    titleRow.replaceChild(actions, badge);
    actions.appendChild(badge);

    const modal = document.createElement('div');
    modal.className = 'modal hidden';
    modal.id = 'quoteTemplatesModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'quoteTemplatesTitle');
    modal.innerHTML = `<div class="modal-backdrop" data-quote-templates-close></div>
      <div class="modal-sheet quote-templates-sheet">
        <div class="modal-head"><div><p class="eyebrow">AGILIDADE NA VENDA</p><h2 id="quoteTemplatesTitle">Pedidos modelos</h2><p class="muted">Crie e reutilize listas prontas sem copiar os dados do cliente.</p></div><button class="modal-close" data-quote-templates-close type="button" aria-label="Fechar">×</button></div>
        <form class="quote-template-form" id="quoteTemplateForm">
          <label>Nome do novo modelo<input id="quoteTemplateName" maxlength="80" placeholder="Ex.: Kit CFTV residencial com 4 câmeras" required></label>
          <label>Observação do modelo<input id="quoteTemplateSummary" maxlength="240" placeholder="Opcional: onde este modelo costuma ser usado"></label>
          <button class="btn primary" id="saveQuoteTemplateBtn" type="submit">Salvar pedido como modelo</button>
        </form>
        <p class="template-security-note">O modelo salva produtos, quantidades e condições comerciais. Nome, documento, telefone e endereço do cliente não são armazenados.</p>
        <div class="quote-template-list" id="quoteTemplateList"><div class="empty-state compact">Carregando modelos…</div></div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('openQuoteTemplatesBtn').addEventListener('click', openQuoteTemplates);
    document.getElementById('openHistoryQuoteTemplatesBtn')?.addEventListener('click', openQuoteTemplates);
    document.getElementById('quoteTemplateForm').addEventListener('submit', saveQuoteTemplate);
    modal.querySelectorAll('[data-quote-templates-close]').forEach(element => element.addEventListener('click', closeQuoteTemplates));
    modal.addEventListener('click', event => {
      const useButton = event.target.closest('[data-use-template]');
      if (useButton) applyQuoteTemplate(useButton.dataset.useTemplate);
      const deleteButton = event.target.closest('[data-delete-template]');
      if (deleteButton) deleteQuoteTemplate(deleteButton.dataset.deleteTemplate);
    });
  }

  function installProductStatusPanel() {
    const panel = document.getElementById('productDescriptionPanel');
    if (!panel || document.getElementById('productStatusPanel')) return;
    const status = document.createElement('div');
    status.className = 'product-status-panel';
    status.id = 'productStatusPanel';
    status.innerHTML = '<div><span class="product-status-dot"></span><strong id="productStatusLabel">Produto ativo</strong><small id="productStatusMeta">Disponível para consulta e orçamento.</small></div><button class="btn danger-outline compact-btn hidden" id="toggleProductStatusBtn" type="button">Marcar como inativo</button>';
    panel.prepend(status);
    document.getElementById('toggleProductStatusBtn').addEventListener('click', togglePendingProductStatus);
  }

  async function loadProductStatuses(force = false) {
    if (statusesLoaded && !force) return;
    try {
      const response = await apiFetch('/api/product-statuses', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível carregar a situação dos produtos.');
      productStatuses = data.statuses || {};
      statusesLoaded = true;
      refreshVisibleProductResults();
      renderProductStatus();
    } catch (error) {
      console.warn(error);
    }
  }

  function renderProductStatus() {
    const panel = document.getElementById('productStatusPanel');
    if (!panel || !pendingPhotoProduct) return;
    const record = statusFor(pendingPhotoProduct.code);
    const inactive = record?.active === false;
    panel.classList.toggle('inactive', inactive);
    document.getElementById('productStatusLabel').textContent = inactive ? 'Produto inativo' : 'Produto ativo';
    const details = inactive
      ? `Não pode ser adicionado ao orçamento${record.updatedBy ? ` · alterado por ${record.updatedBy}` : ''}.`
      : 'Disponível para consulta e orçamento.';
    document.getElementById('productStatusMeta').textContent = details;
    const button = document.getElementById('toggleProductStatusBtn');
    button.classList.toggle('hidden', !canManageProducts());
    button.classList.toggle('danger-outline', !inactive);
    button.classList.toggle('secondary', inactive);
    button.textContent = inactive ? 'Reativar produto' : 'Marcar como inativo';
  }

  async function togglePendingProductStatus() {
    if (!canManageProducts() || !pendingPhotoProduct) return;
    const code = pendingPhotoProduct.code;
    const inactive = productIsInactive(pendingPhotoProduct);
    const action = inactive ? 'reativar' : 'inativar';
    if (!window.confirm(`Deseja ${action} o produto ${code}?`)) return;
    const button = document.getElementById('toggleProductStatusBtn');
    button.disabled = true;
    try {
      const response = await apiFetch('/api/product-statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, active: inactive })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível alterar a situação do produto.');
      productStatuses[code] = data.product;
      renderProductStatus();
      refreshVisibleProductResults();
      showToast(inactive ? 'Produto reativado' : 'Produto marcado como inativo');
    } catch (error) {
      showToast(error.message || 'Não foi possível alterar a situação do produto');
    } finally {
      button.disabled = false;
    }
  }

  async function loadQuoteTemplates(force = false) {
    if (!staffRoles.has(currentUser?.role || '')) return;
    if (templatesLoaded && !force) { renderQuoteTemplates(); return; }
    const list = document.getElementById('quoteTemplateList');
    if (list) list.innerHTML = '<div class="empty-state compact">Carregando modelos…</div>';
    try {
      const response = await apiFetch('/api/quote-templates', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível carregar os modelos.');
      quoteTemplates = Array.isArray(data.templates) ? data.templates : [];
      templatesLoaded = true;
      renderQuoteTemplates();
    } catch (error) {
      if (list) list.innerHTML = `<div class="empty-state compact">${escapeHtml(error.message)}</div>`;
    }
  }

  function openQuoteTemplates(sourceQuote = null) {
    if (!staffRoles.has(currentUser?.role || '')) { showToast('Modelos disponíveis para a equipe de vendas'); return; }
    templateSourceQuote = sourceQuote && Array.isArray(sourceQuote.items) ? structuredClone(sourceQuote) : null;
    const modal = document.getElementById('quoteTemplatesModal');
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    const nameInput = document.getElementById('quoteTemplateName');
    const summaryInput = document.getElementById('quoteTemplateSummary');
    if (templateSourceQuote) {
      nameInput.value = `Pedido ${templateSourceQuote.client?.name || templateSourceQuote.number || ''}`.trim();
      summaryInput.value = `Criado a partir do orçamento nº ${templateSourceQuote.number || ''}`.trim();
    }
    loadQuoteTemplates(true);
  }

  function closeQuoteTemplates() {
    document.getElementById('quoteTemplatesModal')?.classList.add('hidden');
    document.body.classList.remove('modal-open');
    templateSourceQuote = null;
  }

  function renderQuoteTemplates() {
    const list = document.getElementById('quoteTemplateList');
    if (!list) return;
    if (!quoteTemplates.length) {
      list.innerHTML = '<div class="empty-state compact">Nenhum modelo salvo. Monte um orçamento e salve o primeiro.</div>';
      return;
    }
    list.innerHTML = quoteTemplates.map(template => {
      const itemCount = Array.isArray(template.items) ? template.items.length : 0;
      const detail = [
        `${itemCount} ${itemCount === 1 ? 'produto' : 'produtos'}`,
        template.payment,
        template.createdBy ? `por ${template.createdBy}` : ''
      ].filter(Boolean).join(' · ');
      return `<article class="quote-template-card"><div><strong>${escapeHtml(template.name)}</strong>${template.summary ? `<p>${escapeHtml(template.summary)}</p>` : ''}<small>${escapeHtml(detail)}</small></div><div class="quote-template-actions"><button class="btn primary compact-btn" data-use-template="${escapeHtml(template.id)}" type="button">Reutilizar</button>${template.canDelete ? `<button class="btn danger-outline compact-btn" data-delete-template="${escapeHtml(template.id)}" type="button">Excluir</button>` : ''}</div></article>`;
    }).join('');
  }

  async function saveQuoteTemplate(event) {
    event.preventDefault();
    if (!templateSourceQuote) syncFormToQuote();
    const sourceQuote = templateSourceQuote || currentQuote;
    if (!sourceQuote.items.length) { showToast('Adicione produtos antes de salvar o modelo'); showQuoteStep(3); return; }
    const nameInput = document.getElementById('quoteTemplateName');
    const summaryInput = document.getElementById('quoteTemplateSummary');
    const button = document.getElementById('saveQuoteTemplateBtn');
    const payload = {
      name: nameInput.value.trim(),
      summary: summaryInput.value.trim(),
      items: sourceQuote.items.map(item => ({ code: item.code, qty: Number(item.qty) || 1 })),
      payment: sourceQuote.payment,
      validity: sourceQuote.validity,
      discount: sourceQuote.discount,
      freight: sourceQuote.freight,
      notes: sourceQuote.notes
    };
    button.disabled = true;
    button.textContent = 'Salvando…';
    try {
      const response = await apiFetch('/api/quote-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível salvar o modelo.');
      quoteTemplates.unshift(data.template);
      nameInput.value = '';
      summaryInput.value = '';
      renderQuoteTemplates();
      showToast('Modelo de orçamento salvo');
    } catch (error) {
      showToast(error.message || 'Não foi possível salvar o modelo');
    } finally {
      button.disabled = false;
      button.textContent = 'Salvar pedido como modelo';
    }
  }

  function applyQuoteTemplate(id) {
    const template = quoteTemplates.find(item => item.id === id);
    if (!template) return;
    if (currentQuote.items.length && !window.confirm('Aplicar este modelo? Os produtos atuais da cesta serão substituídos.')) return;
    const usable = [];
    let unavailable = 0;
    for (const saved of template.items || []) {
      const product = productByCode(saved.code);
      if (!product || productIsInactive(product)) { unavailable += 1; continue; }
      usable.push({ code: product.code, description: product.desc, qty: Math.max(1, Number(saved.qty) || 1), unitPrice: product.price });
    }
    if (!usable.length) { showToast('Este modelo não possui produtos ativos disponíveis'); return; }
    currentQuote.items = usable;
    currentQuote.payment = template.payment || currentQuote.payment;
    currentQuote.validity = Number(template.validity) || currentQuote.validity;
    currentQuote.discount = Number(template.discount) || 0;
    currentQuote.freight = Number(template.freight) || 0;
    currentQuote.notes = template.notes || '';
    populateQuoteForm();
    closeQuoteTemplates();
    showQuoteStep(3, { scroll: true, focus: false });
    showToast(unavailable ? `Modelo aplicado; ${unavailable} produto(s) inativo(s) foram ignorados` : 'Modelo aplicado com os preços atuais');
  }

  async function deleteQuoteTemplate(id) {
    const template = quoteTemplates.find(item => item.id === id);
    if (!template || !window.confirm(`Excluir o modelo “${template.name}”?`)) return;
    try {
      const response = await apiFetch(`/api/quote-templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível excluir o modelo.');
      quoteTemplates = quoteTemplates.filter(item => item.id !== id);
      renderQuoteTemplates();
      showToast('Modelo excluído');
    } catch (error) {
      showToast(error.message || 'Não foi possível excluir o modelo');
    }
  }

  const previousProductCard = productCard;
  productCard = function(product, mode = 'quote') {
    if (!productIsInactive(product)) return previousProductCard(product, mode);
    const contactButton = mode === 'catalog'
      ? `<button class="sales-contact-btn" data-sales-product-index="${product.i}" type="button">Falar com vendedor</button>`
      : '';
    return `<article class="product-row product-row-with-photo product-inactive">
      ${productMediaHtml(product)}
      <div class="product-copy"><span class="product-code">CÓD. ${escapeHtml(product.code)}</span><span class="product-inactive-tag">INATIVO</span><div class="product-desc">${escapeHtml(product.desc)}</div><div class="product-price">${money.format(product.price)}</div><small class="product-inactive-help">Produto indisponível para novos orçamentos.</small></div>
      <div class="product-actions"><button class="add-product-btn" type="button" disabled>Inativo</button>${contactButton}</div>
    </article>`;
  };

  const previousAddProduct = addProduct;
  addProduct = function(index) {
    const product = productIndex.find(item => item.i === index);
    if (productIsInactive(product)) { showToast('Este produto está inativo e não pode ser adicionado'); return; }
    return previousAddProduct(index);
  };

  const previousValidateQuote = validateQuote;
  validateQuote = function() {
    const inactiveItem = currentQuote.items.find(item => productIsInactive(productByCode(item.code)));
    if (inactiveItem) {
      showToast(`Remova o produto inativo ${inactiveItem.code} antes de continuar`);
      showQuoteStep(3);
      return false;
    }
    return previousValidateQuote();
  };

  const previousSearchClientsNow = searchClientsNow;
  searchClientsNow = async function() {
    const query = document.getElementById('clientSearchInput').value.trim();
    if (normalize(query).length < 2) return previousSearchClientsNow();
    const results = document.getElementById('clientSearchResults');
    document.getElementById('clientSearchClear').classList.toggle('hidden', !query);
    results.className = 'client-search-results empty-state compact';
    results.textContent = 'Pesquisando…';
    try {
      const response = await apiFetch(`/api/clients?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Falha na pesquisa');
      const clients = data.clients || [];
      if (!clients.length) { results.textContent = 'Nenhum cliente encontrado. Confirme se a base já foi importada.'; return; }
      results.className = 'client-search-results';
      results.innerHTML = clients.map((client, index) => `<button class="client-result ${client.blocked ? 'blocked' : ''}" data-client-index="${index}" type="button" ${client.blocked ? 'disabled' : ''}><div><strong>${escapeHtml(client.name)}</strong>${client.fantasyName ? `<span>${escapeHtml(client.fantasyName)}</span>` : ''}<span>${escapeHtml(clientMeta(client))}</span>${client.blocked ? '<span class="blocked-tag">BLOQUEADO</span>' : ''}</div><b>${client.blocked ? 'Não disponível' : 'Selecionar'}</b></button>`).join('');
      results.querySelectorAll('[data-client-index]:not([disabled])').forEach(button => button.addEventListener('click', () => selectClient(clients[Number(button.dataset.clientIndex)])));
    } catch (error) {
      results.textContent = error.message || 'Não foi possível pesquisar clientes.';
    }
  };

  const previousOpenPhoto = openProductPhotoModal;
  openProductPhotoModal = async function(index, requestEdit = false) {
    await previousOpenPhoto(index, requestEdit);
    installProductStatusPanel();
    await loadProductStatuses();
    renderProductStatus();
  };

  const previousApplyUser = applyAuthenticatedUser;
  applyAuthenticatedUser = function(user) {
    previousApplyUser(user);
    loadProductStatuses(true);
    if (staffRoles.has(user?.role || '')) loadQuoteTemplates(true);
  };

  const previousLogout = logout;
  logout = async function() {
    productStatuses = {};
    quoteTemplates = [];
    statusesLoaded = false;
    templatesLoaded = false;
    closeQuoteTemplates();
    await previousLogout();
  };

  document.getElementById('changePasswordForm')?.addEventListener('submit', () => {
    setTimeout(() => {
      if (!currentUser?.mustChangePassword && document.getElementById('changePasswordModal')?.classList.contains('hidden')) {
        loadProductStatuses(true);
        if (staffRoles.has(currentUser.role || '')) loadQuoteTemplates(true);
      }
    }, 700);
  });

  installQuoteTemplates();
  installProductStatusPanel();
  window.openQuoteTemplatesPanel = () => openQuoteTemplates(null);
  window.openQuoteTemplatesFromHistory = id => {
    const quote = getHistory().find(item => item.id === id);
    if (!quote) { showToast('Pedido não encontrado no histórico'); return; }
    openQuoteTemplates(quote);
  };
})();
