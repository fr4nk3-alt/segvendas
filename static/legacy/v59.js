(() => {
  'use strict';

  let teamHistoryRecords = [];

  const teamRoleAllowed = () => ['coordinator', 'admin'].includes(currentUser?.role || '');
  const statusOf = quote => ['sale', 'delivery'].includes(quote?.status) ? quote.status : 'quote';
  const statusLabel = status => ({ quote: 'Orçamento em aberto', delivery: 'Entrega', sale: 'Venda confirmada' }[status] || 'Orçamento');
  const statusBadge = status => `<span class="team-status ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>`;
  const quoteStamp = quote => String(quote?.soldAt || quote?.updatedAt || quote?.createdAt || '');
  const dateKey = value => {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  function installSaleAction() {
    const delivery = $('openDeliveryBtn');
    if (!delivery || $('confirmSaleBtn')) return;
    const button = document.createElement('button');
    button.id = 'confirmSaleBtn';
    button.type = 'button';
    button.className = 'btn sale-confirm span-2';
    button.textContent = '✓ Registrar como venda';
    delivery.before(button);
    button.addEventListener('click', () => {
      syncFormToQuote();
      if (!validateQuote()) return;
      if (!window.confirm('Confirmar este orçamento como venda? Ele passará a fazer parte do resultado do vendedor.')) return;
      currentQuote.status = 'sale';
      currentQuote.soldAt = nowISO();
      if (!saveQuote(true)) return;
      renderHistory();
      showToast('Venda registrada no histórico do vendedor');
    });
  }

  function installTeamPage() {
    if ($('page-team-history')) return;
    const historyPage = $('page-history');
    const page = document.createElement('section');
    page.className = 'page role-hidden';
    page.id = 'page-team-history';
    page.innerHTML = `
      <div class="page-title-row"><div><p class="eyebrow">ACESSO DE COORDENAÇÃO</p><h1>Resultados da equipe</h1><p class="muted" id="teamHistoryScope">Histórico de orçamentos, entregas e vendas confirmadas.</p></div><button class="text-btn" id="exportTeamHistoryBtn" type="button">Exportar CSV</button></div>
      <div class="team-metrics" id="teamMetrics">
        <article><span>Orçamentos em aberto</span><strong id="metricQuotes">0</strong></article>
        <article><span>Entregas</span><strong id="metricDeliveries">0</strong></article>
        <article><span>Vendas confirmadas</span><strong id="metricSales">0</strong></article>
        <article class="money"><span>Valor vendido</span><strong id="metricSalesValue">R$ 0,00</strong></article>
      </div>
      <div class="card team-filter-card"><div class="form-grid team-filter-grid">
        <label>Vendedor<select id="teamSellerFilter"><option value="">Todos</option></select></label>
        <label>Situação<select id="teamStatusFilter"><option value="">Todas</option><option value="quote">Orçamentos em aberto</option><option value="delivery">Entregas</option><option value="sale">Vendas confirmadas</option></select></label>
        <label>Data inicial<input id="teamStartFilter" type="date"></label>
        <label>Data final<input id="teamEndFilter" type="date"></label>
        <button class="btn secondary" id="clearTeamFiltersBtn" type="button">Limpar filtros</button>
      </div></div>
      <div class="history-list empty-state" id="teamHistoryList">Carregando histórico da equipe…</div>`;
    historyPage.after(page);

    const nav = document.createElement('button');
    nav.className = 'nav-btn role-hidden';
    nav.dataset.page = 'team-history';
    nav.innerHTML = '<span>▥</span><small>Equipe</small>';
    document.querySelector('.bottom-nav .nav-btn[data-page="settings"]')?.before(nav);
    nav.addEventListener('click', () => switchPage('team-history'));

    ['teamSellerFilter', 'teamStatusFilter', 'teamStartFilter', 'teamEndFilter'].forEach(id => $(id).addEventListener('input', renderTeamHistory));
    $('clearTeamFiltersBtn').addEventListener('click', () => {
      ['teamSellerFilter', 'teamStatusFilter', 'teamStartFilter', 'teamEndFilter'].forEach(id => { $(id).value = ''; });
      renderTeamHistory();
    });
    $('exportTeamHistoryBtn').addEventListener('click', exportTeamHistory);
  }

  async function loadTeamHistory({ silent = false } = {}) {
    if (!teamRoleAllowed()) return;
    try {
      const response = await apiFetch('/api/team-history', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível consultar o histórico da equipe.');
      teamHistoryRecords = Array.isArray(data.history) ? data.history : [];
      $('teamHistoryScope').textContent = currentUser.role === 'admin'
        ? 'Visão administrativa de todas as lojas.'
        : `Loja: ${data.scope || currentUser.store || 'não informada'}.`;
      const selected = $('teamSellerFilter').value;
      const sellers = [...new Set(teamHistoryRecords.map(item => item.seller).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      $('teamSellerFilter').innerHTML = '<option value="">Todos</option>' + sellers.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
      if (sellers.includes(selected)) $('teamSellerFilter').value = selected;
      renderTeamHistory();
    } catch (error) {
      $('teamHistoryList').className = 'history-list empty-state';
      $('teamHistoryList').textContent = error.message || 'Histórico da equipe indisponível.';
      if (!silent) showToast(error.message || 'Histórico da equipe indisponível');
    }
  }

  function filteredTeamHistory() {
    const seller = $('teamSellerFilter').value;
    const status = $('teamStatusFilter').value;
    const start = $('teamStartFilter').value;
    const end = $('teamEndFilter').value;
    return teamHistoryRecords.filter(quote => {
      const date = dateKey(quoteStamp(quote));
      return (!seller || quote.seller === seller)
        && (!status || statusOf(quote) === status)
        && (!start || date >= start)
        && (!end || date <= end);
    });
  }

  function renderTeamHistory() {
    if (!teamRoleAllowed()) return;
    const records = filteredTeamHistory();
    const quotes = records.filter(item => statusOf(item) === 'quote');
    const deliveries = records.filter(item => statusOf(item) === 'delivery');
    const sales = records.filter(item => statusOf(item) === 'sale');
    $('metricQuotes').textContent = quotes.length.toLocaleString('pt-BR');
    $('metricDeliveries').textContent = deliveries.length.toLocaleString('pt-BR');
    $('metricSales').textContent = sales.length.toLocaleString('pt-BR');
    $('metricSalesValue').textContent = money.format(sales.reduce((sum, quote) => sum + quoteTotals(quote).total, 0));
    const list = $('teamHistoryList');
    if (!records.length) {
      list.className = 'history-list empty-state';
      list.textContent = 'Nenhum registro encontrado para os filtros escolhidos.';
      return;
    }
    list.className = 'history-list';
    list.innerHTML = records.map(quote => `<article class="history-item team-history-item">
      <div class="history-main"><div><div class="history-number">Nº ${escapeHtml(quote.number || '—')} ${statusBadge(statusOf(quote))}</div><div class="history-client">${escapeHtml(quote.client?.name || 'Cliente não informado')}</div><div class="history-meta">${escapeHtml(localDateTime(quoteStamp(quote)))} · ${escapeHtml(quote.seller || 'Sem vendedor')} · ${escapeHtml(quote.store || '')}</div></div><div class="history-total">${money.format(quoteTotals(quote).total)}</div></div>
      <div class="history-actions"><button type="button" data-team-detail="${escapeHtml(quote.id)}">Ver detalhes</button><button type="button" data-team-print="${escapeHtml(quote.id)}">PDF</button></div>
    </article>`).join('');
    list.querySelectorAll('[data-team-detail]').forEach(button => button.addEventListener('click', () => openTeamHistoryDetail(button.dataset.teamDetail)));
    list.querySelectorAll('[data-team-print]').forEach(button => button.addEventListener('click', () => {
      const quote = teamHistoryRecords.find(item => String(item.id) === button.dataset.teamPrint);
      if (quote) printQuote(quote);
    }));
  }

  function openTeamHistoryDetail(id) {
    const quote = teamHistoryRecords.find(item => String(item.id) === String(id));
    if (!quote) return;
    let modal = $('teamHistoryDetailModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'teamHistoryDetailModal';
      modal.className = 'modal hidden';
      modal.innerHTML = '<div class="modal-backdrop" data-team-detail-close></div><div class="modal-sheet team-detail-sheet"><div class="modal-head"><div><p class="eyebrow">CONSULTA SOMENTE LEITURA</p><h2 id="teamDetailTitle">Detalhes do registro</h2></div><button class="modal-close" data-team-detail-close type="button">×</button></div><div id="teamDetailContent"></div></div>';
      document.body.appendChild(modal);
      modal.querySelectorAll('[data-team-detail-close]').forEach(button => button.addEventListener('click', () => { modal.classList.add('hidden'); document.body.classList.remove('modal-open'); }));
    }
    $('teamDetailTitle').textContent = `${statusLabel(statusOf(quote))} nº ${quote.number || '—'}`;
    $('teamDetailContent').innerHTML = `<div class="team-detail-summary"><p><b>Vendedor:</b> ${escapeHtml(quote.seller || '—')}</p><p><b>Loja:</b> ${escapeHtml(quote.store || '—')}</p><p><b>Cliente:</b> ${escapeHtml(quote.client?.name || '—')}</p><p><b>Data:</b> ${escapeHtml(localDateTime(quoteStamp(quote)))}</p></div><div class="team-detail-items">${(quote.items || []).map(item => `<article><div><b>${escapeHtml(item.code)}</b><span>${escapeHtml(item.description)}</span></div><strong>${numberBR.format(item.qty)} × ${money.format(item.unitPrice)}</strong></article>`).join('')}</div><div class="team-detail-total">Total <strong>${money.format(quoteTotals(quote).total)}</strong></div>`;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function csvValue(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
  function exportTeamHistory() {
    const records = filteredTeamHistory();
    if (!records.length) { showToast('Não há registros para exportar'); return; }
    const rows = [['Situação','Número','Data','Loja','Vendedor','Cliente','CPF/CNPJ','Itens','Total'], ...records.map(quote => [
      statusLabel(statusOf(quote)), quote.number, localDateTime(quoteStamp(quote)), quote.store, quote.seller,
      quote.client?.name || '', quote.client?.document || '', quote.items?.length || 0, quoteTotals(quote).total.toFixed(2).replace('.', ',')
    ])];
    const blob = new Blob(['\ufeff' + rows.map(row => row.map(csvValue).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `historico-equipe-${new Date().toISOString().slice(0,10)}.csv`);
  }

  function installIntegrationCard() {
    if ($('integrationSettingsCard')) return;
    const warning = document.querySelector('#page-settings .warning-card');
    const card = document.createElement('div');
    card.id = 'integrationSettingsCard';
    card.className = 'card admin-only hidden';
    card.innerHTML = `<div class="section-head"><div><h2>Integrações com ERP e APIs</h2><p class="muted">Cadastre Dataplace ou outra API. As credenciais ficam protegidas no servidor e nunca são devolvidas ao navegador.</p></div><span class="role-badge" id="integrationBadge">Desativada</span></div>
      <div class="notice integration-notice">Esta tela configura e testa a conexão. A sincronização de clientes, preços e produtos só deve ser ativada depois do mapeamento dos campos fornecido pelo ERP.</div>
      <form class="form-grid two" id="integrationForm">
        <label>Tipo de integração<select id="integrationProvider"><option value="dataplace">Dataplace</option><option value="generic">Outra API REST</option></select></label>
        <label>Nome da conexão<input id="integrationName" maxlength="100" placeholder="Ex.: Dataplace Matriz"></label>
        <label class="span-2">URL principal<input id="integrationBaseUrl" maxlength="500" placeholder="https://api.exemplo.com" required></label>
        <label>Endpoint de teste<input id="integrationTestPath" maxlength="300" placeholder="api/status"></label>
        <label>Autenticação<select id="integrationAuthType"><option value="bearer">Bearer Token</option><option value="api-key">API Key</option><option value="none">Sem autenticação</option></select></label>
        <label id="integrationHeaderLabel">Cabeçalho da API Key<input id="integrationApiKeyHeader" maxlength="80" value="X-API-Key"></label>
        <label>Credencial / token<input id="integrationSecret" autocomplete="new-password" maxlength="10000" type="password" placeholder="Deixe vazio para manter a credencial atual"></label>
        <label>Endpoint de clientes<input id="integrationCustomersPath" maxlength="300" placeholder="api/clientes"></label>
        <label>Endpoint de produtos<input id="integrationProductsPath" maxlength="300" placeholder="api/produtos"></label>
        <label class="integration-enabled span-2"><input id="integrationEnabled" type="checkbox"> Habilitar conector para as futuras rotinas de sincronização</label>
        <div class="integration-actions span-2"><button class="btn secondary" id="testIntegrationBtn" type="button">Testar conexão</button><button class="btn primary" type="submit">Salvar configuração</button></div>
      </form><p class="permission-copy" id="integrationStatus">Nenhuma integração configurada.</p>
      <div class="notice integration-notice" id="syncStatusMessage">Fila offline ainda não consultada.</div>
      <div class="integration-actions"><button class="btn secondary" id="refreshSyncStatusBtn" type="button">Atualizar fila</button><button class="btn ghost" id="runSyncBtn" type="button">Enviar fila agora</button></div>`;
    warning?.before(card);
    $('integrationForm').addEventListener('submit', saveIntegration);
    $('testIntegrationBtn').addEventListener('click', testIntegration);
    $('refreshSyncStatusBtn').addEventListener('click', loadSyncStatus);
    $('runSyncBtn').addEventListener('click', runSyncNow);
    $('integrationAuthType').addEventListener('change', updateIntegrationAuthUI);
  }

  function installReplicationCard() {
    if ($('storeReplicationCard')) return;
    const warning = document.querySelector('#page-settings .warning-card');
    const card = document.createElement('div');
    card.id = 'storeReplicationCard';
    card.className = 'card admin-only hidden';
    card.innerHTML = `<div class="section-head"><div><h2>Backup e comunicação entre lojas</h2><p class="muted">Cada loja mantém uma cópia local e uma fila segura de alterações. A sincronização externa só acontece quando for configurada pelo administrador.</p></div><span class="role-badge" id="storeReplicationBadge">Local</span></div>
      <div class="notice integration-notice" id="storeReplicationStatusMessage">Backup local ainda não consultado.</div>
      <div class="integration-actions"><button class="btn secondary" id="refreshStoreReplicationBtn" type="button">Atualizar status</button><button class="btn ghost" id="runStoreReplicationBtn" type="button">Sincronizar agora</button><button class="btn ghost" id="backupStoreReplicationBtn" type="button">Criar backup agora</button></div>`;
    warning?.before(card);
    $('refreshStoreReplicationBtn').addEventListener('click', loadStoreReplicationStatus);
    $('runStoreReplicationBtn').addEventListener('click', runStoreReplication);
    $('backupStoreReplicationBtn').addEventListener('click', createStoreBackup);
  }

  async function loadStoreReplicationStatus({ silent = false } = {}) {
    if (currentUser?.role !== 'admin') return;
    const message = $('storeReplicationStatusMessage');
    try {
      const response = await apiFetch('/api/replication-status', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Status da réplica indisponível.');
      const replication = data.replication || {};
      const ledger = replication.ledger || {};
      const counts = ledger.outbox || {};
      $('storeReplicationBadge').textContent = replication.enabled ? 'Sincronização ativa' : 'Somente local';
      message.textContent = `${replication.storeName || 'Loja'} (${replication.storeId || 'local'}) · pendentes: ${counts.pending || 0} · novas tentativas: ${counts.retry || 0} · enviados: ${counts.sent || 0} · falhos: ${counts.failed || 0} · último backup: ${replication.lastBackupAt ? localDateTime(replication.lastBackupAt) : 'ainda não criado'}.`;
    } catch (error) {
      message.textContent = error.message || 'Não foi possível consultar a réplica.';
      if (!silent) showToast(message.textContent);
    }
  }

  async function runStoreReplication() {
    const button = $('runStoreReplicationBtn');
    button.disabled = true; button.textContent = 'Sincronizando…';
    try {
      const response = await apiFetch('/api/replication-run', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível sincronizar as lojas.');
      showToast(`Sincronização concluída: ${data.result?.sent || 0} enviado(s), ${data.result?.received || 0} recebido(s).`);
      await loadStoreReplicationStatus({ silent: true });
    } catch (error) { showToast(error.message || 'Falha na sincronização.'); }
    finally { button.disabled = false; button.textContent = 'Sincronizar agora'; }
  }

  async function createStoreBackup() {
    const button = $('backupStoreReplicationBtn');
    button.disabled = true; button.textContent = 'Criando…';
    try {
      const response = await apiFetch('/api/replication-backup', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível criar o backup.');
      showToast(`Backup local criado com ${data.backup?.files || 0} arquivo(s).`);
      await loadStoreReplicationStatus({ silent: true });
    } catch (error) { showToast(error.message || 'Falha ao criar backup.'); }
    finally { button.disabled = false; button.textContent = 'Criar backup agora'; }
  }

  function updateIntegrationAuthUI() {
    const type = $('integrationAuthType').value;
    $('integrationHeaderLabel').classList.toggle('hidden', type !== 'api-key');
    $('integrationSecret').disabled = type === 'none';
  }

  function fillIntegration(config = {}) {
    $('integrationProvider').value = config.provider || 'dataplace';
    $('integrationName').value = config.name || '';
    $('integrationBaseUrl').value = config.baseUrl || '';
    $('integrationTestPath').value = config.testPath || '';
    $('integrationAuthType').value = config.authType || 'bearer';
    $('integrationApiKeyHeader').value = config.apiKeyHeader || 'X-API-Key';
    $('integrationCustomersPath').value = config.customersPath || '';
    $('integrationProductsPath').value = config.productsPath || '';
    $('integrationEnabled').checked = Boolean(config.enabled);
    $('integrationSecret').value = '';
    $('integrationSecret').placeholder = config.hasSecret ? 'Credencial protegida — deixe vazio para manter' : 'Informe a credencial da API';
    $('integrationBadge').textContent = config.enabled ? 'Habilitada' : 'Desativada';
    $('integrationBadge').classList.toggle('coordinator', Boolean(config.enabled));
    $('integrationStatus').textContent = config.updatedAt ? `Última configuração: ${localDateTime(config.updatedAt)} por ${config.updatedBy || 'administrador'}.` : 'Nenhuma integração configurada.';
    updateIntegrationAuthUI();
  }

  async function loadIntegration({ silent = false } = {}) {
    if (currentUser?.role !== 'admin') return;
    try {
      const response = await apiFetch('/api/integrations', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Integração indisponível.');
      fillIntegration(data.integration);
    } catch (error) {
      $('integrationStatus').textContent = error.message || 'Não foi possível carregar a integração.';
      if (!silent) showToast(error.message || 'Integração indisponível');
    }
  }

  function integrationPayload() {
    return {
      provider: $('integrationProvider').value, name: $('integrationName').value.trim(), baseUrl: $('integrationBaseUrl').value.trim(),
      testPath: $('integrationTestPath').value.trim(), authType: $('integrationAuthType').value,
      apiKeyHeader: $('integrationApiKeyHeader').value.trim(), secret: $('integrationSecret').value,
      customersPath: $('integrationCustomersPath').value.trim(), productsPath: $('integrationProductsPath').value.trim(),
      enabled: $('integrationEnabled').checked
    };
  }

  async function saveIntegration(event) {
    event.preventDefault();
    const button = event.submitter || $('integrationForm').querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Salvando…';
    try {
      const response = await apiFetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(integrationPayload()) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível salvar a integração.');
      fillIntegration(data.integration); showToast('Configuração da API salva no servidor');
    } catch (error) { showToast(error.message || 'Falha ao salvar integração'); }
    finally { button.disabled = false; button.textContent = 'Salvar configuração'; }
  }

  async function testIntegration() {
    const button = $('testIntegrationBtn');
    button.disabled = true; button.textContent = 'Testando…';
    $('integrationStatus').textContent = 'Conectando ao endereço configurado…';
    try {
      const response = await apiFetch('/api/integrations/test', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Falha no teste de conexão.');
      $('integrationStatus').textContent = `${data.message} HTTP ${data.status} · ${data.elapsedMs} ms.`;
      showToast('Conexão com a API confirmada');
    } catch (error) { $('integrationStatus').textContent = error.message || 'Não foi possível conectar.'; showToast(error.message || 'Falha no teste'); }
    finally { button.disabled = false; button.textContent = 'Testar conexão'; }
  }

  async function loadSyncStatus({ silent = false } = {}) {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'coordinator') return;
    const message = $('syncStatusMessage');
    try {
      const response = await apiFetch('/api/sync-status', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Fila indisponível.');
      const counts = data.queue?.counts || {};
      const enabled = data.dataplace?.enabled ? 'Dataplace habilitado' : 'Dataplace ainda não habilitado';
      message.textContent = `${enabled} · pendentes: ${counts.pending || 0} · em nova tentativa: ${counts.retry || 0} · enviados: ${counts.sent || 0} · falhos: ${counts.failed || 0}.`;
    } catch (error) {
      message.textContent = error.message || 'Não foi possível consultar a fila.';
      if (!silent) showToast(message.textContent);
    }
  }

  async function runSyncNow() {
    const button = $('runSyncBtn');
    button.disabled = true; button.textContent = 'Enviando…';
    try {
      const response = await apiFetch('/api/sync-run', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível enviar a fila.');
      showToast(`Fila processada: ${data.result?.sent || 0} enviado(s).`);
      await loadSyncStatus({ silent: true });
    } catch (error) { showToast(error.message || 'Falha ao processar a fila.'); }
    finally { button.disabled = false; button.textContent = 'Enviar fila agora'; }
  }

  installSaleAction();
  installTeamPage();
  installIntegrationCard();
  installReplicationCard();

  const previousPermittedPages = permittedPagesForRole;
  permittedPagesForRole = function(role) {
    const pages = previousPermittedPages(role);
    return ['coordinator', 'admin'].includes(role) ? [...new Set([...pages, 'team-history'])] : pages;
  };

  const previousSwitchPage = switchPage;
  switchPage = function(page) {
    previousSwitchPage(page);
    if (page === 'team-history' && teamRoleAllowed()) loadTeamHistory({ silent: true });
    if (page === 'settings' && currentUser?.role === 'admin') { loadIntegration({ silent: true }); loadSyncStatus({ silent: true }); loadStoreReplicationStatus({ silent: true }); }
  };

  const previousApplyAuthenticatedUser = applyAuthenticatedUser;
  applyAuthenticatedUser = function(user) {
    previousApplyAuthenticatedUser(user);
    if (['coordinator', 'admin'].includes(user.role)) loadTeamHistory({ silent: true });
    if (user.role === 'admin') { loadIntegration({ silent: true }); loadSyncStatus({ silent: true }); loadStoreReplicationStatus({ silent: true }); }
  };
})();
