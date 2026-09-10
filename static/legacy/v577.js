'use strict';

(() => {
  const byId = id => document.getElementById(id);
  const chatMessages = byId('chatMessages');
  const quickPrompts = byId('assistantQuickPrompts');
  if (!chatMessages || !quickPrompts) return;

  const TECH_TOPICS = [
    {
      id: 'cftv', label: 'CFTV e câmeras', words: ['camera', 'cftv', 'colorvu', 'infravermelho', 'lente', 'imagem'],
      answer: 'Em CFTV, resolução é apenas uma parte do projeto. Lente, iluminação, altura, ângulo, compressão, taxa de quadros e distância até o alvo também influenciam a identificação.',
      question: 'Você precisa reconhecer pessoas, ler placas ou apenas acompanhar o ambiente?',
      tips: [
        'Uma câmera com muitos megapixels não garante identificação se a lente deixar o alvo pequeno na imagem.',
        'Antes de definir a câmera, confirme distância, largura da cena, iluminação e o nível de detalhe esperado.',
        'Visão noturna colorida depende de luz disponível ou iluminação auxiliar; confira o requisito do modelo.'
      ]
    },
    {
      id: 'gravacao', label: 'DVR, NVR e gravação', words: ['dvr', 'nvr', 'gravador', 'gravacao', 'hd', 'armazenamento', 'canal'],
      answer: 'DVR trabalha principalmente com câmeras analógicas; NVR recebe câmeras IP pela rede. Alguns gravadores são híbridos, mas a quantidade de canais, resolução e protocolos aceitos precisa ser confirmada no manual.',
      question: 'Quantas câmeras, qual resolução e quantos dias de gravação você precisa manter?',
      tips: [
        'O tempo de gravação depende de quantidade de câmeras, resolução, FPS, compressão, movimento da cena e capacidade do disco.',
        'Um gravador com canais livres ainda pode atingir o limite total de banda; confira entrada e saída em Mbps.',
        'Use discos recomendados para videomonitoramento quando a gravação for contínua.'
      ]
    },
    {
      id: 'rede', label: 'Rede e PoE', words: ['rede', 'poe', 'switch', 'ip', 'internet', 'roteador', 'mbps', 'vlan'],
      answer: 'Em projetos IP, verifique a potência PoE disponível, a banda total, o endereçamento e a distância do enlace. Em Ethernet convencional, o canal completo normalmente deve ficar dentro de 100 metros.',
      question: 'Quantos equipamentos IP serão ligados e qual é a maior distância até o switch?',
      tips: [
        'A potência PoE total do switch precisa atender a soma das cargas, não apenas a quantidade de portas.',
        'Separar CFTV em uma VLAN facilita organização, segurança e diagnóstico da rede.',
        'Troque senhas padrão, limite acessos externos e mantenha firmware e horário dos equipamentos atualizados.'
      ]
    },
    {
      id: 'cabos', label: 'Cabos e sinal', words: ['cabo', 'coaxial', 'utp', 'balun', 'conector', 'distancia', 'metro'],
      answer: 'O cabo deve ser escolhido pelo tipo de sinal, distância e ambiente. Em CFTV analógico, confira impedância e qualidade do condutor; em rede, respeite a categoria, a conectorização e o limite do enlace.',
      question: 'O sinal será analógico, IP ou alimentação, e qual é a distância aproximada?',
      tips: [
        'Emendas e conectores mal montados costumam causar mais falhas do que o equipamento principal.',
        'Evite compartilhar o mesmo caminho com cabos de potência; cruzamentos, quando inevitáveis, devem seguir boas práticas elétricas.',
        'Queda de tensão aumenta com distância e corrente. Meça a tensão também na ponta da carga.'
      ]
    },
    {
      id: 'fonte', label: 'Fontes e alimentação', words: ['fonte', 'alimentacao', 'amper', 'corrente', 'voltagem', 'tensao', '12v', '24v'],
      answer: 'Para dimensionar uma fonte, some a corrente máxima dos equipamentos na mesma tensão e deixe margem operacional. Também considere distância, bitola do cabo, partida e queda de tensão.',
      question: 'Qual é a tensão e o consumo máximo de cada equipamento ligado à fonte?',
      tips: [
        'Uma margem de aproximadamente 20% a 30% costuma evitar que a fonte trabalhe continuamente no limite, salvo orientação diferente do fabricante.',
        'Não misture equipamentos de tensões diferentes na mesma saída sem conversão adequada.',
        'A tensão medida sem carga pode parecer normal mesmo quando a fonte falha sob consumo.'
      ]
    },
    {
      id: 'alarme', label: 'Alarmes e sensores', words: ['alarme', 'sensor', 'sirene', 'zona', 'central', 'pet', 'infravermelho'],
      answer: 'Em alarmes, posição do sensor, altura, direção, temperatura, animais e supervisão da fiação interferem na confiabilidade. O resistor de fim de linha deve seguir o manual da central.',
      question: 'O ambiente é interno ou externo e possui animais, correntes de ar ou incidência direta de sol?',
      tips: [
        'Instalar o resistor de fim de linha junto ao sensor ajuda a central a supervisionar toda a fiação da zona.',
        'Sensores infravermelhos não devem apontar diretamente para fontes de calor ou áreas com mudança térmica brusca.',
        'Teste cada zona e registre a identificação antes de entregar o sistema ao cliente.'
      ]
    },
    {
      id: 'acesso', label: 'Controle de acesso', words: ['acesso', 'fechadura', 'biometria', 'facial', 'eletroima', 'botao', 'leitor'],
      answer: 'Em controle de acesso, confirme o tipo de fechadura, tensão, corrente, lógica de segurança, sensor de porta e forma de saída em emergência. O comportamento sem energia deve fazer parte do projeto.',
      question: 'A porta precisa permanecer trancada ou destrancada quando faltar energia?',
      tips: [
        'Fail-safe destrava sem energia; fail-secure tende a permanecer travada. A escolha depende do risco e das regras de saída do local.',
        'Fechaduras e eletroímãs podem exigir corrente de partida maior do que a corrente nominal.',
        'Cadastros biométricos devem seguir política de privacidade e acesso restrito.'
      ]
    },
    {
      id: 'portao', label: 'Automatizadores', words: ['portao', 'motor', 'automatizador', 'cremalheira', 'fotocelula', 'controle remoto'],
      answer: 'Para escolher um automatizador, considere peso, tamanho, equilíbrio mecânico, quantidade de ciclos, velocidade, alimentação e ambiente. Fotocélula e ajuste de força são itens de segurança, não acessórios opcionais.',
      question: 'Qual é o tipo de portão, peso aproximado e quantidade de aberturas por hora?',
      tips: [
        'Um portão pesado ou desalinhado reduz a vida útil do automatizador mesmo quando o motor parece potente.',
        'A capacidade de ciclos por hora pode ser mais importante do que a velocidade nominal.',
        'Teste fotocélula, desaceleração, fim de curso e liberação manual antes da entrega.'
      ]
    },
    {
      id: 'protecao', label: 'Proteção elétrica', words: ['surto', 'aterramento', 'dps', 'raio', 'protecao', 'nobreak'],
      answer: 'Proteção contra surtos exige uma abordagem conjunta: aterramento adequado, equipotencialização, DPS compatível, proteção dos cabos que entram no prédio e alimentação organizada.',
      question: 'Os equipamentos ficam em área externa ou recebem cabos vindos de outros prédios?',
      tips: [
        'Proteger apenas a tomada pode não proteger surtos que chegam pelo cabo de rede, coaxial ou sinal.',
        'O aterramento deve ser verificado por profissional habilitado; improvisos podem aumentar o risco.',
        'Nobreak melhora continuidade, mas não substitui projeto de proteção contra surtos.'
      ]
    }
  ];

  const QUICK_PROMPTS = [
    ['✨', 'Curiosidade técnica', 'Me conte uma curiosidade técnica'],
    ['◉', 'DVR ou NVR?', 'Qual a diferença entre DVR e NVR?'],
    ['⚡', 'Dimensionar fonte', 'Como dimensionar uma fonte?'],
    ['⌁', 'Cabo para CFTV', 'Como escolher cabo para CFTV?'],
    ['⌕', 'Pesquisar produto', 'Pesquisar câmera ColorVu']
  ];

  let curiosityIndex = Math.floor(Math.random() * TECH_TOPICS.reduce((total, topic) => total + topic.tips.length, 0));
  let automaticTipSent = false;

  function normalized(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function allTips() {
    return TECH_TOPICS.flatMap(topic => topic.tips.map(text => ({ label: topic.label, text })));
  }

  function nextCuriosity(preferredTopic = null) {
    const pool = preferredTopic?.tips?.length
      ? preferredTopic.tips.map(text => ({ label: preferredTopic.label, text }))
      : allTips();
    const item = pool[curiosityIndex % pool.length];
    curiosityIndex += 1;
    return item;
  }

  function topicFor(query) {
    const value = normalized(query);
    const specific = [
      ['fonte', /fonte|alimentacao|amper|corrente|12v|24v/],
      ['cabos', /cabo|coaxial|utp|balun|conector/],
      ['gravacao', /dvr|nvr|gravador|gravacao|armazenamento/],
      ['rede', /rede|poe|switch|roteador|vlan|mbps/],
      ['alarme', /alarme|sensor|sirene|zona/],
      ['acesso', /controle de acesso|fechadura|biometria|facial|eletroima/],
      ['portao', /portao|automatizador|cremalheira|fotocelula/],
      ['protecao', /surto|aterramento|dps|raio|nobreak/]
    ].find(([, pattern]) => pattern.test(value));
    if (specific) return TECH_TOPICS.find(topic => topic.id === specific[0]) || null;
    return TECH_TOPICS.find(topic => topic.words.some(word => value.includes(word))) || null;
  }

  function safetyNote(query) {
    const value = normalized(query);
    if (/220v|127v|alta tensao|quadro|aterramento|dps|incendio|fogo|portao/.test(value)) {
      return '<p class="assistant-safety-note"><strong>Segurança:</strong> confirme o manual e as normas aplicáveis. Serviços elétricos, incêndio e partes móveis devem ser executados por profissional habilitado.</p>';
    }
    return '';
  }

  function curiosityReply(topic = null) {
    const item = nextCuriosity(topic);
    return `<div class="assistant-tip-card"><span>Curiosidade técnica · ${escapeHtml(item.label)}</span><strong>${escapeHtml(item.text)}</strong></div><p>Quer outra curiosidade ou prefere aprofundar esse assunto?</p>`;
  }

  function productReply(query, topic) {
    const found = searchProducts(query, 5);
    if (!found.length) {
      return '<p>Não encontrei um item correspondente no catálogo atual. Tente informar o código exato, a marca ou uma parte menor da descrição.</p>';
    }
    const clientMode = currentUser?.role === 'client';
    const cards = found.map(product => `<div class="chat-product"><strong>${escapeHtml(product.code)}</strong><br>${escapeHtml(product.desc)}<br><strong>${money.format(product.price)}</strong><br>${clientMode ? '' : `<button type="button" data-chat-product="${product.i}">Adicionar ao orçamento</button>`}<button class="chat-sales-btn" type="button" data-chat-sales="${product.i}">Falar com vendedor</button></div>`).join('');
    const guidance = topic ? `<p class="assistant-related-guidance"><strong>Antes de escolher:</strong> ${escapeHtml(topic.answer)}</p>` : '';
    return `<p>Encontrei estas opções no catálogo atual:</p>${cards}${guidance}`;
  }

  function assistantTechnicalReply(query) {
    const value = normalized(query);
    const topic = topicFor(query);
    if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai)\b/.test(value)) {
      return '<p>Olá! Posso conversar sobre projetos de segurança eletrônica, explicar conceitos, sugerir verificações ou pesquisar produtos e preços. Qual é o seu projeto hoje?</p>';
    }
    if (/obrigad|valeu|ajudou/.test(value)) {
      return '<p>Fico feliz em ajudar. Se quiser, posso trazer uma curiosidade relacionada ou ajudar a conferir os pontos principais do projeto.</p>';
    }
    if (/curios|dica tecnica|voce sabia|sabia que|outra dica/.test(value)) return curiosityReply(topic);
    if (/diferenca.*dvr.*nvr|dvr.*ou.*nvr|nvr.*ou.*dvr/.test(value)) {
      return `<p><strong>DVR:</strong> recebe principalmente câmeras analógicas pelo cabeamento de vídeo. <strong>NVR:</strong> grava câmeras IP recebidas pela rede. Modelos híbridos podem aceitar tecnologias diferentes, mas canais, resolução, banda e protocolos variam.</p><p>${escapeHtml(TECH_TOPICS[1].question)}</p>`;
    }
    if (/dimension|calcular|calculo/.test(value) && /fonte|corrente|amper|alimentacao/.test(value)) {
      return `<p>1. Confirme a tensão de todos os equipamentos.<br>2. Some a corrente máxima das cargas na mesma tensão.<br>3. Considere partida e queda de tensão.<br>4. Reserve margem operacional, normalmente em torno de 20% a 30%, salvo indicação diferente do fabricante.</p><p>Informe tensão, corrente e quantidade de equipamentos que eu organizo o cálculo com você.</p>${safetyNote(query)}`;
    }
    const productIntent = /preco|valor|quanto custa|catalogo|produto|codigo|pesquis|procur|localiz|tem disponivel/.test(value) || /\b\d{3,14}\b/.test(value);
    if (productIntent) return productReply(query, topic);
    if (topic) {
      return `<p>${escapeHtml(topic.answer)}</p><p><strong>Para orientar melhor:</strong> ${escapeHtml(topic.question)}</p>${safetyNote(query)}`;
    }
    if (/manual|configur|instal|ligacao|esquema/.test(value)) {
      return '<p>Posso ajudar a organizar a dúvida, mas ligações e parâmetros específicos precisam ser confirmados no manual do modelo. Informe fabricante, modelo e o que você deseja configurar.</p>';
    }
    return '<p>Posso ajudar de três formas: explicar um assunto técnico, pesquisar produtos e preços ou trazer curiosidades. Informe o equipamento, o cenário e o que você precisa decidir.</p>';
  }

  function bindChatActions() {
    chatMessages.querySelectorAll('[data-chat-product]').forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => { addProduct(Number(button.dataset.chatProduct)); switchPage('quote'); });
    });
    chatMessages.querySelectorAll('[data-chat-sales]').forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => openSalesContact(Number(button.dataset.chatSales)));
    });
  }

  window.sendAssistantMessage = function sendAssistantMessageV577(query) {
    const text = String(query || '').trim();
    if (!text) return;
    chatMessages.insertAdjacentHTML('beforeend', `<div class="chat-message user">${escapeHtml(text)}</div>`);
    chatMessages.insertAdjacentHTML('beforeend', `<div class="chat-message bot">${assistantTechnicalReply(text)}</div>`);
    bindChatActions();
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  quickPrompts.innerHTML = QUICK_PROMPTS.map(([icon, label, query]) => `<button data-assistant-prompt="${escapeHtml(query)}" type="button"><span aria-hidden="true">${icon}</span>${escapeHtml(label)}</button>`).join('');
  quickPrompts.addEventListener('click', event => {
    const button = event.target.closest('[data-assistant-prompt]');
    if (!button) return;
    window.sendAssistantMessage(button.dataset.assistantPrompt);
  });

  const assistantPage = byId('page-assistant');
  const pageObserver = new MutationObserver(() => {
    if (!assistantPage?.classList.contains('active') || automaticTipSent) return;
    automaticTipSent = true;
    setTimeout(() => {
      if (!assistantPage.classList.contains('active')) return;
      const item = nextCuriosity();
      chatMessages.insertAdjacentHTML('beforeend', `<div class="chat-message bot assistant-auto-tip"><div class="assistant-tip-card"><span>Curiosidade automática · ${escapeHtml(item.label)}</span><strong>${escapeHtml(item.text)}</strong></div></div>`);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 450);
  });
  if (assistantPage) pageObserver.observe(assistantPage, { attributes: true, attributeFilter: ['class'] });

  const mascotChooser = document.querySelector('.assistant-avatar-chooser');
  if (mascotChooser && !byId('nestorxCuriosityButton')) {
    const curiosityButton = document.createElement('button');
    curiosityButton.className = 'nestorx-curiosity-button';
    curiosityButton.id = 'nestorxCuriosityButton';
    curiosityButton.type = 'button';
    curiosityButton.innerHTML = '<span aria-hidden="true">✨</span> Curiosidade técnica';
    mascotChooser.parentNode.insertBefore(curiosityButton, mascotChooser);
    curiosityButton.addEventListener('click', () => {
      const item = nextCuriosity();
      const feedback = byId('nestorxHelpFeedback');
      if (!feedback) return;
      feedback.textContent = `${item.label}: ${item.text}`;
      feedback.classList.remove('hidden', 'is-error');
    });
  }

  const forgotModal = byId('forgotPasswordModal');
  const forgotForm = byId('forgotPasswordForm');
  const forgotSubmit = byId('forgotPasswordSubmit');
  const forgotStatus = byId('forgotPasswordStatus');
  const forgotError = byId('forgotPasswordError');

  function openForgotPassword() {
    forgotForm.reset();
    forgotError.classList.add('hidden');
    forgotError.textContent = '';
    forgotStatus.textContent = 'Depois da aprovação, entre com seu código e a senha de fábrica SEG@código.';
    forgotStatus.className = 'recovery-status is-ready';
    forgotSubmit.disabled = false;
    byId('forgotPasswordUsername').value = byId('loginUsername')?.value.trim() || '';
    openModal('forgotPasswordModal');
    setTimeout(() => byId('forgotPasswordUsername')?.focus(), 60);
  }

  async function submitForgotPassword(event) {
    event.preventDefault();
    const username = byId('forgotPasswordUsername').value.trim();
    forgotError.classList.add('hidden');
    if (!username) {
      forgotError.textContent = 'Informe seu código ou usuário.';
      forgotError.classList.remove('hidden');
      return;
    }
    forgotSubmit.disabled = true;
    forgotSubmit.textContent = 'Enviando pedido…';
    try {
      const response = await window.fetch('/api/password-reset-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível enviar o pedido.');
      byId('loginUsername').value = username;
      byId('loginPassword').value = '';
      closeModal('forgotPasswordModal');
      setSeguitoLoginState('attentive', 'Pedido enviado. Aguarde um administrador autorizar a recuperação.');
      showToast(data.message || 'Pedido de recuperação enviado ao servidor');
    } catch (error) {
      forgotError.textContent = location.protocol === 'file:'
        ? 'Abra o sistema pelo atalho para enviar o pedido ao servidor.'
        : (error.message || 'Não foi possível enviar o pedido.');
      forgotError.classList.remove('hidden');
    } finally {
      forgotSubmit.disabled = false;
      forgotSubmit.textContent = 'Enviar pedido de recuperação';
    }
  }

  byId('openForgotPasswordBtn')?.addEventListener('click', openForgotPassword);
  forgotForm?.addEventListener('submit', submitForgotPassword);
  forgotModal?.querySelectorAll('[data-close-modal="forgotPasswordModal"]').forEach(element => element.addEventListener('click', () => closeModal('forgotPasswordModal')));
})();
