'use strict';

/* Versão 5.9.9 — fluxo de instalação PWA para Android e iPhone. */
(() => {
  const card = document.getElementById('mobileInstallCard');
  const button = document.getElementById('installMobileBtn');
  const status = document.getElementById('installMobileStatus');
  const loginButton = document.getElementById('installMobileLoginBtn');
  const loginStatus = document.getElementById('installMobileLoginStatus');
  if (!button || !status) return;
  const installButtons = [button, loginButton].filter(Boolean);

  let deferredPrompt = null;
  const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.classList.remove('is-ready', 'is-installed', 'is-warning');
    if (kind) status.classList.add(`is-${kind}`);
    if (loginStatus) loginStatus.textContent = message;
  }

  function showInstalledState() {
    if (!isStandalone()) return;
    card?.classList.add('is-installed');
    setStatus('O SEG Vendas já está instalado neste celular.', 'installed');
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    installButtons.forEach(item => { item.disabled = false; item.textContent = 'Instalar no celular'; });
    setStatus('Instalação pronta. Toque no botão para adicionar o SEG Vendas à tela inicial.', 'ready');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    card?.classList.add('is-installed');
    setStatus('Instalação concluída. O SEG Vendas está na tela inicial.', 'installed');
  });

  async function startInstall() {
    if (isStandalone()) {
      showInstalledState();
      return;
    }
    if (!deferredPrompt) {
      if (isIos()) {
        setStatus('No iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”.', 'warning');
      } else {
        setStatus('Se o botão de instalação não aparecer, abra este endereço no Chrome e use ⋮ → Instalar aplicativo.', 'warning');
      }
      return;
    }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice?.outcome === 'accepted') {
      card?.classList.add('is-installed');
      setStatus('Instalação aceita. O ícone aparecerá na tela inicial.', 'installed');
    } else {
      setStatus('Instalação cancelada. Você pode tentar novamente quando quiser.', 'warning');
    }
  }

  installButtons.forEach(item => item.addEventListener('click', startInstall));

  showInstalledState();
})();
