'use strict';

(() => {
  let descriptions = {};
  let descriptionsLoaded = false;

  const canEditDescriptions = () => ['seller','coordinator','admin'].includes(currentUser?.role || '');
  const formatUpdate = value => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR');
  };

  function installDescriptionPanel() {
    const stage = document.querySelector('#productPhotoModal .photo-preview-stage');
    if (!stage || document.getElementById('productDescriptionPanel')) return;
    const stack = document.createElement('div');
    stack.className = 'photo-product-stack';
    stage.parentNode.insertBefore(stack, stage);
    stack.appendChild(stage);
    const panel = document.createElement('section');
    panel.className = 'product-description-panel';
    panel.id = 'productDescriptionPanel';
    panel.innerHTML = `<div class="product-description-head"><strong>Descrição detalhada</strong><button class="text-btn hidden" id="editProductDescriptionBtn" type="button">Adicionar descrição</button></div><p class="product-description-text empty" id="productDescriptionText">Este produto ainda não possui uma descrição detalhada.</p><small class="product-description-meta" id="productDescriptionMeta"></small><form class="product-description-form hidden" id="productDescriptionForm"><textarea id="productDescriptionInput" maxlength="1200" placeholder="Descreva aplicações, características e informações úteis do produto."></textarea><div class="product-description-form-actions"><span class="product-description-count" id="productDescriptionCount">0 / 1.200</span><button class="btn ghost compact-btn" id="cancelProductDescriptionBtn" type="button">Cancelar</button><button class="btn primary compact-btn" id="saveProductDescriptionBtn" type="submit">Salvar descrição</button></div></form>`;
    stack.appendChild(panel);
    document.getElementById('editProductDescriptionBtn').addEventListener('click', openDescriptionEditor);
    document.getElementById('cancelProductDescriptionBtn').addEventListener('click', () => renderProductDescription());
    document.getElementById('productDescriptionInput').addEventListener('input', updateDescriptionCount);
    document.getElementById('productDescriptionForm').addEventListener('submit', saveProductDescription);
  }

  async function loadDescriptions(force = false) {
    if (descriptionsLoaded && !force) return;
    try {
      const response = await apiFetch('/api/product-descriptions', {cache:'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível carregar as descrições.');
      descriptions = data.descriptions || {};
      descriptionsLoaded = true;
    } catch (error) {
      console.warn(error);
    }
  }

  function renderProductDescription() {
    const product = pendingPhotoProduct;
    if (!product) return;
    const record = descriptions[String(product.code)] || null;
    const text = document.getElementById('productDescriptionText');
    const meta = document.getElementById('productDescriptionMeta');
    const edit = document.getElementById('editProductDescriptionBtn');
    const form = document.getElementById('productDescriptionForm');
    form.classList.add('hidden');
    text.classList.remove('hidden');
    meta.classList.remove('hidden');
    text.textContent = record?.description || 'Este produto ainda não possui uma descrição detalhada.';
    text.classList.toggle('empty', !record?.description);
    const updated = formatUpdate(record?.updatedAt);
    meta.textContent = updated ? `Atualizada em ${updated}${record.updatedBy ? ` por ${record.updatedBy}` : ''}.` : '';
    edit.classList.toggle('hidden', !canEditDescriptions());
    edit.textContent = record?.description ? 'Editar descrição' : '＋ Adicionar descrição';
  }

  function updateDescriptionCount() {
    const input = document.getElementById('productDescriptionInput');
    document.getElementById('productDescriptionCount').textContent = `${input.value.length.toLocaleString('pt-BR')} / 1.200`;
  }

  function openDescriptionEditor() {
    if (!canEditDescriptions() || !pendingPhotoProduct) return;
    const record = descriptions[String(pendingPhotoProduct.code)] || null;
    const input = document.getElementById('productDescriptionInput');
    input.value = record?.description || '';
    document.getElementById('productDescriptionText').classList.add('hidden');
    document.getElementById('productDescriptionMeta').classList.add('hidden');
    document.getElementById('productDescriptionForm').classList.remove('hidden');
    updateDescriptionCount();
    input.focus();
  }

  async function saveProductDescription(event) {
    event.preventDefault();
    if (!canEditDescriptions() || !pendingPhotoProduct) return;
    const input = document.getElementById('productDescriptionInput');
    const button = document.getElementById('saveProductDescriptionBtn');
    const description = input.value.trim();
    if (description.length < 10) { showToast('Escreva pelo menos 10 caracteres'); input.focus(); return; }
    const code = String(pendingPhotoProduct.code);
    const current = descriptions[code] || null;
    button.disabled = true; button.textContent = 'Salvando…';
    try {
      const response = await apiFetch('/api/product-descriptions', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,description,baseRevision:current?.revision || 0})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível salvar a descrição.');
      descriptions[code] = data.product;
      renderProductDescription();
      showToast('Descrição do produto salva');
    } catch (error) {
      if (String(error.message).includes('alterada por outra pessoa')) await loadDescriptions(true);
      showToast(error.message || 'Não foi possível salvar a descrição');
    } finally { button.disabled = false; button.textContent = 'Salvar descrição'; }
  }

  function installSecurityStatus() {
    const settings = document.getElementById('page-settings');
    const firstCard = settings?.querySelector('.card');
    if (!settings || !firstCard || document.getElementById('securityStatusCard')) return;
    const card = document.createElement('div'); card.className='card security-status-card'; card.id='securityStatusCard';
    card.innerHTML='<div class="section-head"><div><h2>Segurança do aplicativo</h2><p class="muted">Proteções ativas nesta versão.</p></div><span class="badge stable">Ativa</span></div><div class="security-status-list"><div class="security-status-item"><b>Senhas temporárias</b>Troca obrigatória no primeiro acesso interno.</div><div class="security-status-item"><b>Tentativas de login</b>Bloqueio temporário contra tentativas repetidas.</div><div class="security-status-item"><b>Sessões</b>Expiram após inatividade e têm duração máxima.</div><div class="security-status-item"><b>Arquivos internos</b>Bases, planilhas, backups e registros protegidos.</div></div>';
    settings.insertBefore(card, firstCard);
  }

  function forcePasswordChangeIfNeeded(user) {
    const modal = document.getElementById('changePasswordModal');
    if (!modal) return;
    const mandatory = Boolean(user?.mustChangePassword);
    modal.classList.toggle('password-mandatory', mandatory);
    let notice = document.getElementById('passwordSecurityNotice');
    if (!notice) { notice=document.createElement('div'); notice.id='passwordSecurityNotice'; notice.className='password-security-notice'; notice.textContent='Por segurança, esta conta ainda usa uma senha temporária. Crie agora uma senha pessoal com pelo menos 8 caracteres, incluindo letras e números.'; document.getElementById('changePasswordForm').prepend(notice); }
    notice.classList.toggle('hidden', !mandatory);
    if (mandatory) setTimeout(() => openChangePasswordModal(), 120);
  }

  async function openProtectedManual(anchor) {
    const popup = window.open('', '_blank');
    try {
      const response = await apiFetch(anchor.getAttribute('href'), {cache:'no-store'});
      if (!response.ok) { const data=await response.json().catch(()=>({})); throw new Error(data.message || 'Manual indisponível.'); }
      const blobUrl = URL.createObjectURL(await response.blob());
      if (popup) popup.location.href = blobUrl; else downloadBlob(await (await fetch(blobUrl)).blob(), 'manual.pdf');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    } catch (error) { popup?.close(); showToast(error.message || 'Não foi possível abrir o manual'); }
  }

  installDescriptionPanel(); installSecurityStatus();
  ['registerPassword','registerPasswordConfirm','newPassword','confirmNewPassword'].forEach(id => { const el=document.getElementById(id); if(el) el.minLength=8; });

  const originalOpenPhoto = openProductPhotoModal;
  openProductPhotoModal = async function(index, requestEdit=false) { await originalOpenPhoto(index, requestEdit); await loadDescriptions(); renderProductDescription(); };

  const originalApplyUser = applyAuthenticatedUser;
  applyAuthenticatedUser = function(user) { originalApplyUser(user); document.getElementById('employeeImportCard')?.classList.toggle('hidden', user?.role !== 'admin'); forcePasswordChangeIfNeeded(user); if (!user?.mustChangePassword) loadDescriptions(true); };

  const originalPasswordChange = submitPasswordChange;
  submitPasswordChange = async function(event) { await originalPasswordChange(event); const modal=document.getElementById('changePasswordModal'); if (modal?.classList.contains('hidden') && currentUser) { currentUser.mustChangePassword=false; forcePasswordChangeIfNeeded(currentUser); loadServerManuals({silent:true}); loadServerPhotos({silent:true}); loadDescriptions(true); } };

  const originalLogout = logout;
  logout = async function() { descriptions={}; descriptionsLoaded=false; await originalLogout(); };

  document.addEventListener('click', event => {
    const anchor=event.target.closest('a[href^="manuais/"],a[href^="/manuais/"]');
    if(anchor){event.preventDefault();openProtectedManual(anchor);return;}
    if(currentUser?.mustChangePassword && event.target.closest('[data-close-modal="changePasswordModal"]')){event.preventDefault();event.stopImmediatePropagation();}
  }, true);
  document.addEventListener('keydown', event => { if(currentUser?.mustChangePassword && event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();} }, true);
})();
