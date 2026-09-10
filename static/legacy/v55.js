'use strict';

(() => {
  const tips = [
    'Antes de fechar o orçamento, confirme a tensão e a compatibilidade dos produtos.',
    'Câmeras com maior resolução normalmente exigem mais espaço de armazenamento.',
    'A manutenção preventiva ajuda a prolongar a vida útil dos equipamentos.',
    'Confira alimentação, cabeamento e configuração antes de substituir um equipamento.',
    'Em uma entrega, confirme endereço, telefone e pessoa responsável pelo recebimento.'
  ];
  let employeeFile = null;
  let clientPageTimer = null;
  let clientPageResults = [];

  function esc(value) { return escapeHtml(String(value ?? '')); }
  function isManager() { return ['coordinator','admin'].includes(currentUser?.role || ''); }
  function authFetch(url, options = {}) { return apiFetch(url, options); }
  function clientLocation(c) { return [c.address, c.neighborhood, c.city, c.state, c.cep].filter(Boolean).join(' · '); }

  function installNestor() {
    const dockButton = document.getElementById('seguitoDockButton');
    if (dockButton) {
      dockButton.setAttribute('aria-label', 'Abrir dica do Nestor');
      dockButton.innerHTML = '<img class="nestor-dock-avatar" src="assets/nestor-rosto.png" alt="Nestor"><span class="nestor-lamp" aria-hidden="true">💡</span>';
    }
    const tip = document.getElementById('seguitoTip');
    if (tip) tip.innerHTML = '<button id="closeSeguitoTip" type="button">×</button><img src="assets/nestor-rosto.png" alt="Nestor"><strong>Nestor</strong><p id="seguitoTipText">Clique na lâmpada quando quiser uma dica.</p>';
    document.querySelectorAll('strong').forEach(el => { if (el.textContent.trim() === 'SEGuito') el.textContent = 'Nestor'; });
    document.getElementById('closeSeguitoTip')?.addEventListener('click', e => { e.stopPropagation(); tip?.classList.add('hidden'); });
    dockButton?.addEventListener('click', () => { const p = document.getElementById('seguitoTipText'); if (p) p.textContent = tips[Math.floor(Math.random() * tips.length)]; });
  }

  function installClientsPage() {
    const history = document.getElementById('page-history');
    if (!history) return;
    const page = document.createElement('section');
    page.className = 'page'; page.id = 'page-clients';
    page.innerHTML = `<div class="page-title-row"><div><p class="eyebrow">BASE INTERNA</p><h1>Clientes</h1></div><button class="text-btn" id="clientsBackBtn" type="button">Voltar</button></div>
      <div class="card"><div class="client-page-toolbar"><div class="search-wrap"><span>⌕</span><input id="clientsPageSearch" type="search" autocomplete="off" placeholder="Nome, código, CPF/CNPJ ou telefone"></div><button class="btn secondary" id="clientsPageRefresh" type="button">Atualizar</button></div><p class="permission-copy">Pesquise a base, selecione um cliente para o orçamento ou bloqueie/desbloqueie o cadastro.</p><div class="client-page-list" id="clientsPageList"><div class="empty-state compact">Carregando clientes…</div></div></div>`;
    history.before(page);
    document.getElementById('clientsBackBtn').onclick = () => { switchPage('quote'); showHomeScreen?.(); };
    document.getElementById('clientsPageRefresh').onclick = () => loadClientsPage(true);
    document.getElementById('clientsPageSearch').addEventListener('input', () => { clearTimeout(clientPageTimer); clientPageTimer = setTimeout(() => loadClientsPage(false), 260); });
    page.addEventListener('click', handleClientPageAction);
    const quick = document.querySelector('[data-action="clients"]');
    quick?.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); hideHomeScreen(); switchPage('clients'); loadClientsPage(true); }, true);
  }

  async function loadClientsPage(initial) {
    const list = document.getElementById('clientsPageList');
    if (!list) return;
    const typed = document.getElementById('clientsPageSearch').value.trim();
    const query = typed.length >= 2 ? typed : (initial ? '__all__' : '');
    if (!query) { list.innerHTML = '<div class="empty-state compact">Digite pelo menos 2 caracteres.</div>'; return; }
    list.innerHTML = '<div class="empty-state compact">Pesquisando…</div>';
    try {
      const response = await authFetch(`/api/clients?q=${encodeURIComponent(query)}`, {cache:'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Falha na pesquisa');
      clientPageResults = data.clients || [];
      if (!clientPageResults.length) { list.innerHTML = '<div class="empty-state compact">Nenhum cliente encontrado.</div>'; return; }
      list.innerHTML = clientPageResults.map((c,i) => `<article class="client-page-card ${c.blocked?'blocked':''}"><div><strong>${esc(c.name)}</strong>${c.fantasyName?`<span>${esc(c.fantasyName)}</span>`:''}<span>Cód. ${esc(c.code||'—')} · ${esc(c.document||'Sem CPF/CNPJ')} · ${esc(c.phone||c.whatsapp||'Sem telefone')}</span><small>${esc(clientLocation(c)||'Endereço não informado')}</small>${c.blocked?'<span class="blocked-tag">BLOQUEADO</span>':''}</div><div class="client-page-actions"><button class="btn primary compact-btn" data-use-client="${i}" ${c.blocked?'disabled':''}>Usar no orçamento</button>${isManager()?`<button class="btn ${c.blocked?'secondary':'danger-outline'} compact-btn" data-block-client="${i}">${c.blocked?'Desbloquear':'Bloquear'}</button>`:''}</div></article>`).join('');
    } catch (e) { list.innerHTML = `<div class="empty-state compact">${esc(e.message)}</div>`; }
  }

  async function handleClientPageAction(event) {
    const use = event.target.closest('[data-use-client]');
    if (use) { const c=clientPageResults[Number(use.dataset.useClient)]; if (!c || c.blocked) return; selectClient(c); switchPage('quote'); showQuoteStep(2,{scroll:false}); return; }
    const block = event.target.closest('[data-block-client]');
    if (!block) return;
    const c=clientPageResults[Number(block.dataset.blockClient)];
    if (!c || !window.confirm(`${c.blocked?'Desbloquear':'Bloquear'} o cliente ${c.name}?`)) return;
    const response=await authFetch('/api/clients/block',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:c.id,blocked:!c.blocked})});
    const data=await response.json(); if(!response.ok){showToast(data.message||'Não foi possível alterar o bloqueio');return;} showToast(data.client.blocked?'Cliente bloqueado':'Cliente desbloqueado'); loadClientsPage(false);
  }

  function installEmployeeImport() {
    const input=document.getElementById('employeeFileInput'), button=document.getElementById('importEmployeesBtn'), status=document.getElementById('employeeImportStatus');
    if(!input||!button) return;
    input.addEventListener('change',()=>{employeeFile=input.files?.[0]||null;button.disabled=!employeeFile;status.textContent=employeeFile?`Arquivo selecionado: ${employeeFile.name}`:'Nenhum arquivo selecionado.';});
    button.addEventListener('click',async()=>{if(!employeeFile)return;button.disabled=true;button.textContent='Importando…';try{const fileDataBase64=await blobToDataUrl(employeeFile);const response=await authFetch('/api/employees/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileName:employeeFile.name,fileDataBase64})});const data=await response.json();if(!response.ok)throw new Error(data.message||'Falha na importação');status.textContent=`${data.count} acessos ativos. ${data.added} novo(s) funcionário(s). Senhas existentes preservadas.`;employeeFile=null;input.value='';showToast('Base de funcionários atualizada');}catch(e){status.textContent=e.message;showToast(e.message);}finally{button.textContent='Importar funcionários';button.disabled=!employeeFile;}});
  }

  function installDelivery() {
    const modal=document.createElement('div');modal.className='modal hidden';modal.id='deliveryModal';modal.innerHTML=`<div class="modal-backdrop" data-delivery-close></div><div class="modal-sheet delivery-sheet"><div class="modal-head"><div><p class="eyebrow">LOGÍSTICA</p><h2>Formulário de entrega</h2></div><button class="modal-close" data-delivery-close>×</button></div><div class="delivery-summary" id="deliverySummary"></div><div class="form-grid two"><label class="span-2">Endereço de entrega<input id="deliveryAddress"></label><label>Data prevista<input id="deliveryDate" type="date"></label><label>Período<select id="deliveryPeriod"><option>Manhã</option><option>Tarde</option><option>Horário comercial</option></select></label><label>Responsável pelo recebimento<input id="deliveryReceiver"></label><label>Telefone<input id="deliveryPhone"></label><label class="span-2">Observações<textarea id="deliveryNotes" rows="3"></textarea></label></div><div class="delivery-actions"><button class="btn primary" id="saveDeliveryBtn">Salvar entrega</button><button class="btn secondary" id="printDeliveryValues">Imprimir com valores</button><button class="btn secondary" id="printDeliveryNoValues">Imprimir sem valores</button></div><p class="delivery-save-status hidden" id="deliverySaveStatus" role="status"></p></div>`;document.body.appendChild(modal);
    document.getElementById('openDeliveryBtn')?.addEventListener('click',()=>{syncFormToQuote();if(!currentQuote.client.name){showToast('Selecione o cliente antes de fechar a entrega');showQuoteStep(2);return;}if(!currentQuote.items.length){showToast('Adicione ao menos um produto antes de fechar a entrega');showQuoteStep(3);return;}const delivery=currentQuote.delivery||{};document.getElementById('deliverySummary').innerHTML=`<strong>${esc(currentQuote.client.name)}</strong><br>Orçamento nº ${esc(currentQuote.number)} · ${esc(currentQuote.store)} · ${esc(currentQuote.seller)} · ${esc(currentQuote.payment)}`;document.getElementById('deliveryAddress').value=delivery.address||currentQuote.client.address||'';document.getElementById('deliveryDate').value=delivery.date||'';document.getElementById('deliveryPeriod').value=delivery.period||'Manhã';document.getElementById('deliveryPhone').value=delivery.phone||currentQuote.client.phone||'';document.getElementById('deliveryReceiver').value=delivery.receiver||currentQuote.client.name||'';document.getElementById('deliveryNotes').value=delivery.notes||currentQuote.notes||'';document.getElementById('deliverySaveStatus').classList.add('hidden');modal.classList.remove('hidden');document.body.classList.add('modal-open');});
    modal.querySelectorAll('[data-delivery-close]').forEach(x=>x.onclick=()=>{modal.classList.add('hidden');document.body.classList.remove('modal-open');});
    document.getElementById('saveDeliveryBtn').onclick=()=>saveDelivery();document.getElementById('printDeliveryValues').onclick=()=>printDelivery(true);document.getElementById('printDeliveryNoValues').onclick=()=>printDelivery(false);
  }

  function saveDelivery(showConfirmation=true) {
    syncFormToQuote();
    if(!currentQuote.client.name||!currentQuote.items.length)return false;
    currentQuote.delivery={address:document.getElementById('deliveryAddress').value.trim(),date:document.getElementById('deliveryDate').value,period:document.getElementById('deliveryPeriod').value,receiver:document.getElementById('deliveryReceiver').value.trim(),phone:document.getElementById('deliveryPhone').value.trim(),notes:document.getElementById('deliveryNotes').value.trim(),savedAt:new Date().toISOString()};
    currentQuote.status='delivery';
    if(!saveQuote(true))return false;
    const status=document.getElementById('deliverySaveStatus');status.textContent='Entrega salva no histórico do pedido.';status.classList.remove('hidden');
    if(showConfirmation)showToast('Entrega salva com sucesso');
    return true;
  }

  function printDelivery(withValues) {
    if(!saveDelivery(false))return;
    const total=quoteTotals(currentQuote).total; const rows=currentQuote.items.map(i=>`<tr><td>${esc(i.code)}</td><td>${esc(i.description)}${warrantySealsText(i)?`<small style="display:block;margin-top:4px"><b>Selos:</b> ${esc(warrantySealsText(i))}</small>`:''}</td><td>${esc(i.qty)}</td>${withValues?`<td>${esc(money.format(i.unitPrice))}</td><td>${esc(money.format(i.qty*i.unitPrice))}</td>`:''}</tr>`).join('');
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Entrega ${esc(currentQuote.number)}</title><style>body{font:14px Arial;color:#18231d;margin:32px}h1{color:#006a3b}.head{display:flex;justify-content:space-between}.box{border:1px solid #ccd9d2;border-radius:10px;padding:14px;margin:14px 0}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}.sign{margin-top:70px;border-top:1px solid;width:320px;padding-top:8px}@media print{button{display:none}}</style></head><body><div class="head"><img src="assets/logo-seg.png" style="max-width:220px"><div><h1>FORMULÁRIO DE ENTREGA</h1><b>Orçamento nº ${esc(currentQuote.number)}</b></div></div><div class="box"><b>Cliente:</b> ${esc(currentQuote.client.name)}<br><b>CPF/CNPJ:</b> ${esc(currentQuote.client.document||'—')}<br><b>Endereço:</b> ${esc(document.getElementById('deliveryAddress').value)}<br><b>Responsável:</b> ${esc(document.getElementById('deliveryReceiver').value)} · <b>Telefone:</b> ${esc(document.getElementById('deliveryPhone').value)}<br><b>Data/Período:</b> ${esc(document.getElementById('deliveryDate').value||'A combinar')} · ${esc(document.getElementById('deliveryPeriod').value)}</div><div class="box"><b>Loja:</b> ${esc(currentQuote.store)} · <b>Vendedor:</b> ${esc(currentQuote.seller)} · <b>Pagamento:</b> ${esc(currentQuote.payment)}</div><table><thead><tr><th>Código</th><th>Produto</th><th>Qtd.</th>${withValues?'<th>Unitário</th><th>Total</th>':''}</tr></thead><tbody>${rows}</tbody></table>${withValues?`<h2>Total: ${esc(money.format(total))}</h2>`:''}<p><b>Observações:</b> ${esc(document.getElementById('deliveryNotes').value||'—')}</p><div class="sign">Assinatura do responsável pelo recebimento</div></body></html>`;
    const win=window.open('','_blank');if(!win){showToast('Permita pop-ups para imprimir a entrega');return;}win.document.write(html);win.document.close();setTimeout(()=>win.print(),300);
  }

  const originalPermitted = permittedPagesForRole;
  permittedPagesForRole = function(role){const pages=originalPermitted(role);return ['seller','coordinator','admin'].includes(role)?[...new Set([...pages,'clients'])]:pages;};
  const originalSelectClient = selectClient;
  selectClient = function(client){ if(client?.blocked){showToast('Este cliente está bloqueado e não pode ser usado no orçamento');return;} return originalSelectClient(client); };
  installNestor(); installClientsPage(); installEmployeeImport(); installDelivery();
})();
