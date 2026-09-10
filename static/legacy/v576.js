'use strict';

(() => {
  const mover = document.getElementById('nestorxMover');
  const picture = mover?.querySelector('.nestorx-picture');
  const tip = document.getElementById('seguitoTip');
  const actions = tip?.querySelector('.nestorx-tip-actions');
  if (!mover || !picture || !tip || !actions) return;

  const STORAGE_KEY = 'seg_assistant_avatar';
  let currentAvatarKey = 'nestorx';
  const AVATARS = Object.freeze({
    nestorx: {
      name: 'NestorX',
      to: 'ao NestorX',
      of: 'do NestorX',
      image: '<source srcset="assets/nestorx-fullbody.webp" type="image/webp"><img class="nestorx-figure" src="assets/nestorx-fullbody.png" alt="" width="559" height="1623" decoding="async">',
      preview: 'assets/nestorx-fullbody.webp'
    },
    seguito: {
      name: 'SEGuito',
      to: 'ao SEGuito',
      of: 'do SEGuito',
      image: '<img class="nestorx-figure assistant-figure-seguito" src="assets/seguito-avatar.svg" alt="" width="220" height="240" decoding="async">',
      preview: 'assets/seguito-avatar.svg'
    },
    pretinha: {
      name: 'Pretinha',
      to: 'à Pretinha',
      of: 'da Pretinha',
      image: '<source srcset="assets/pretinha-fullbody.webp" type="image/webp"><img class="nestorx-figure assistant-figure-pretinha" src="assets/pretinha-fullbody.png" alt="" width="610" height="900" decoding="async">',
      preview: 'assets/pretinha-fullbody.webp'
    }
  });

  const chooser = document.createElement('section');
  chooser.className = 'assistant-avatar-chooser';
  chooser.setAttribute('aria-labelledby', 'assistantAvatarLabel');
  chooser.innerHTML = `<strong id="assistantAvatarLabel">Escolher mascote</strong>
    <div class="assistant-avatar-options" role="group" aria-label="Escolha quem acompanha você">
      ${Object.entries(AVATARS).map(([key, avatar]) => `<button class="assistant-avatar-option" data-assistant-avatar="${key}" type="button" aria-pressed="false"><span><img src="${avatar.preview}" alt=""></span><b>${avatar.name}</b></button>`).join('')}
    </div>`;
  actions.parentNode.insertBefore(chooser, actions);

  function readAvatar() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || 'nestorx';
      return AVATARS[saved] ? saved : 'nestorx';
    } catch {
      return 'nestorx';
    }
  }

  function saveAvatar(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* armazenamento indisponível */ }
  }

  function updateAccessibleNames(avatar) {
    const { name, to, of } = avatar;
    const lamp = document.getElementById('seguitoDockButton');
    const title = document.getElementById('nestorxTipTitle');
    const close = document.getElementById('closeSeguitoTip');
    const pause = document.getElementById('nestorxPauseButton');
    const hide = document.getElementById('nestorxHideButton');
    const restore = document.getElementById('nestorxRestoreButton');
    if (title) title.textContent = name;
    if (lamp) {
      lamp.setAttribute('aria-label', `Abrir funções ${to}; arraste para mover`);
      lamp.title = `Abrir funções ${to} — arraste para mover`;
    }
    if (close) close.setAttribute('aria-label', `Fechar ajuda ${of}`);
    if (pause && !pause.disabled) pause.setAttribute('aria-label', `${pause.textContent.includes('▶') ? 'Retomar' : 'Pausar'} movimento ${of}`);
    if (hide) hide.setAttribute('aria-label', `Ocultar ${name}`);
    if (restore) restore.setAttribute('aria-label', `Mostrar ${name}`);
    actions.setAttribute('aria-label', `Controles ${of}`);
  }

  function applyAvatar(key, announce = false) {
    const avatarKey = AVATARS[key] ? key : 'nestorx';
    const avatar = AVATARS[avatarKey];
    currentAvatarKey = avatarKey;
    mover.dataset.avatar = avatarKey;
    picture.innerHTML = avatar.image;
    chooser.querySelectorAll('[data-assistant-avatar]').forEach(button => {
      const selected = button.dataset.assistantAvatar === avatarKey;
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.classList.toggle('selected', selected);
    });
    updateAccessibleNames(avatar);
    saveAvatar(avatarKey);
    window.dispatchEvent(new Event('resize'));
    if (announce && typeof showToast === 'function') showToast(`${avatar.name} agora acompanha você`);
  }

  chooser.addEventListener('click', event => {
    const button = event.target.closest('[data-assistant-avatar]');
    if (!button) return;
    applyAvatar(button.dataset.assistantAvatar, true);
  });

  actions.addEventListener('click', () => {
    setTimeout(() => updateAccessibleNames(AVATARS[currentAvatarKey]), 0);
  });
  document.getElementById('nestorxRestoreButton')?.addEventListener('click', () => {
    setTimeout(() => updateAccessibleNames(AVATARS[currentAvatarKey]), 0);
  });

  applyAvatar(readAvatar(), false);
})();
