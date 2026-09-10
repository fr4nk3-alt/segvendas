'use strict';

(() => {
  let pendingProfilePhoto = null;

  function installProfilePhoto() {
    if (document.getElementById('profilePhotoModal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal hidden';
    modal.id = 'profilePhotoModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'profilePhotoTitle');
    modal.innerHTML = `<div class="modal-backdrop" data-profile-photo-close></div>
      <div class="modal-sheet profile-photo-sheet">
        <div class="modal-head"><div><p class="eyebrow">MEU PERFIL</p><h2 id="profilePhotoTitle">Foto do usuário</h2><p class="muted">A foto fica vinculada à sua conta.</p></div><button class="modal-close" data-profile-photo-close type="button" aria-label="Fechar">×</button></div>
        <div class="profile-photo-preview"><span id="profilePhotoFallback">S</span><img alt="Prévia da foto do usuário" class="hidden" id="profilePhotoPreview"></div>
        <div class="profile-photo-picker">
          <label class="btn primary">📷 Tirar foto<input accept="image/jpeg,image/png,image/webp" capture="user" class="visually-hidden" id="profilePhotoCameraInput" type="file"></label>
          <label class="btn secondary">🖼 Escolher do aparelho<input accept="image/jpeg,image/png,image/webp" class="visually-hidden" id="profilePhotoFileInput" type="file"></label>
        </div>
        <p class="modal-help">Use uma foto bem iluminada. Ela será recortada em formato quadrado.</p>
        <div class="profile-photo-actions"><button class="btn danger-outline" id="removeProfilePhotoBtn" type="button">Remover foto</button><button class="btn primary" disabled id="saveProfilePhotoBtn" type="button">Salvar foto</button></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-profile-photo-close]').forEach(element => element.addEventListener('click', closeProfilePhoto));
    ['profilePhotoCameraInput', 'profilePhotoFileInput'].forEach(id => document.getElementById(id).addEventListener('change', event => selectProfilePhoto(event.target.files?.[0])));
    document.getElementById('saveProfilePhotoBtn').addEventListener('click', saveProfilePhoto);
    document.getElementById('removeProfilePhotoBtn').addEventListener('click', removeProfilePhoto);
    const chip = document.getElementById('loggedUserChip');
    chip?.addEventListener('click', openProfilePhoto);
    chip?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProfilePhoto(); }
    });
  }

  function renderUserAvatar(user = currentUser) {
    if (!user) return;
    const initial = document.getElementById('loggedUserInitial');
    if (!initial) return;
    let avatar = document.getElementById('loggedUserAvatar');
    if (!avatar) {
      avatar = document.createElement('img');
      avatar.id = 'loggedUserAvatar';
      avatar.className = 'hidden';
      avatar.alt = 'Foto do usuário';
      initial.appendChild(avatar);
    }
    const fallback = (user.name || 'S').trim().charAt(0).toUpperCase();
    const textNode = [...initial.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.nodeValue = fallback;
    else initial.prepend(document.createTextNode(fallback));
    if (user.avatarUrl) {
      avatar.src = `${user.avatarUrl}${user.avatarUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
      avatar.classList.remove('hidden');
      initial.classList.add('has-avatar');
    } else {
      avatar.removeAttribute('src');
      avatar.classList.add('hidden');
      initial.classList.remove('has-avatar');
    }
  }

  function openProfilePhoto() {
    if (!currentUser) return;
    pendingProfilePhoto = null;
    const fallback = (currentUser.name || 'S').trim().charAt(0).toUpperCase();
    document.getElementById('profilePhotoFallback').textContent = fallback;
    const preview = document.getElementById('profilePhotoPreview');
    if (currentUser.avatarUrl) {
      preview.src = currentUser.avatarUrl;
      preview.classList.remove('hidden');
    } else {
      preview.removeAttribute('src');
      preview.classList.add('hidden');
    }
    document.getElementById('profilePhotoFallback').classList.toggle('hidden', Boolean(currentUser.avatarUrl));
    document.getElementById('removeProfilePhotoBtn').classList.toggle('hidden', !currentUser.avatarUrl);
    document.getElementById('saveProfilePhotoBtn').disabled = true;
    document.getElementById('profilePhotoModal').classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeProfilePhoto() {
    document.getElementById('profilePhotoModal')?.classList.add('hidden');
    document.body.classList.remove('modal-open');
    pendingProfilePhoto = null;
    ['profilePhotoCameraInput', 'profilePhotoFileInput'].forEach(id => { const input = document.getElementById(id); if (input) input.value = ''; });
  }

  function selectProfilePhoto(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) { showToast('Escolha uma imagem JPG, PNG ou WEBP'); return; }
    if (file.size > 10_000_000) { showToast('A foto deve ter no máximo 10 MB'); return; }
    pendingProfilePhoto = file;
    const preview = document.getElementById('profilePhotoPreview');
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
    document.getElementById('profilePhotoFallback').classList.add('hidden');
    document.getElementById('saveProfilePhotoBtn').disabled = false;
  }

  async function squareProfilePhoto(file) {
    let source;
    let width;
    let height;
    let release = () => {};
    if ('createImageBitmap' in window) {
      source = await createImageBitmap(file);
      width = source.width;
      height = source.height;
      release = () => source.close?.();
    } else {
      const objectUrl = URL.createObjectURL(file);
      source = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Não foi possível abrir a foto.'));
        image.src = objectUrl;
      });
      width = source.naturalWidth;
      height = source.naturalHeight;
      release = () => URL.revokeObjectURL(objectUrl);
    }
    const side = Math.min(width, height);
    const sourceX = (width - side) / 2;
    const sourceY = (height - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    canvas.getContext('2d').drawImage(source, sourceX, sourceY, side, side, 0, 0, 512, 512);
    release();
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a foto.')), 'image/jpeg', .88));
  }

  async function saveProfilePhoto() {
    if (!pendingProfilePhoto) return;
    const button = document.getElementById('saveProfilePhotoBtn');
    button.disabled = true;
    button.textContent = 'Salvando…';
    try {
      const blob = await squareProfilePhoto(pendingProfilePhoto);
      const fileDataBase64 = await blobToDataUrl(blob);
      const response = await apiFetch('/api/profile-photo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'perfil.jpg', fileDataBase64 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível salvar a foto.');
      currentUser = data.user;
      renderUserAvatar(currentUser);
      closeProfilePhoto();
      showToast('Foto de perfil salva');
    } catch (error) {
      showToast(error.message || 'Não foi possível salvar a foto');
    } finally {
      button.disabled = false;
      button.textContent = 'Salvar foto';
    }
  }

  async function removeProfilePhoto() {
    if (!currentUser?.avatarUrl || !window.confirm('Remover sua foto de perfil?')) return;
    try {
      const response = await apiFetch('/api/profile-photo', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível remover a foto.');
      currentUser = data.user;
      renderUserAvatar(currentUser);
      closeProfilePhoto();
      showToast('Foto de perfil removida');
    } catch (error) {
      showToast(error.message || 'Não foi possível remover a foto');
    }
  }

  const previousApplyUser = applyAuthenticatedUser;
  applyAuthenticatedUser = function(user) {
    previousApplyUser(user);
    renderUserAvatar(user);
  };

  installProfilePhoto();
  if (currentUser) renderUserAvatar(currentUser);
})();
