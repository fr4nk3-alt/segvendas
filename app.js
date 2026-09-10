'use strict';

const STORE_CONFIG = {
  'Loja de JPA / SEG Matriz': [
    { name: 'Dayany', role: 'coordinator' },
    { name: 'Aline', role: 'coordinator' },
    { name: 'Arilson', role: 'seller' },
    { name: 'Evelyn', role: 'seller' },
    { name: 'Filipe Mores', role: 'seller' },
    { name: 'Ketsa', role: 'seller' },
    { name: 'Ludmila', role: 'seller' },
    { name: 'Rodrigo', role: 'seller' },
    { name: 'Rafaela', role: 'seller' },
    { name: 'Guilherme', role: 'seller' }
  ],
  'SEG Oeste (Campo Grande)': [
    { name: 'Marcio', role: 'seller' },
    { name: 'Junior', role: 'seller' },
    { name: 'Felipe', role: 'seller' },
    { name: 'Bianca', role: 'seller' },
    { name: 'Clarice', role: 'coordinator' }
  ],
  'SEG São Cristóvão': [
    { name: 'Davi', role: 'seller' },
    { name: 'Leonardo', role: 'seller' },
    { name: 'Eliane', role: 'coordinator' }
  ],
  'SEG Lagos': [
    { name: 'Samantha', role: 'seller' },
    { name: 'Jorge', role: 'seller' },
    { name: 'Viviane', role: 'seller' },
    { name: 'Lucas', role: 'seller' }
  ]
};
const STORES = Object.keys(STORE_CONFIG);
const NORMAL_SELLER_DISCOUNT_MAX = 4;
const PROMOTION_DATE = '2026-07-31';
const PROMOTION_SELLER_DISCOUNT = 8;
// Cada filial tem uma sigla própria para que o número seja imediatamente
// identificável (ex.: Oeste -> OE00022). A sequência é mantida por sigla no
// navegador e confirmada pelo servidor local quando o orçamento é salvo.
const QUOTE_PREFIXES = Object.freeze({
  'Loja de JPA / SEG Matriz': 'MA',
  'SEG Oeste (Campo Grande)': 'OE',
  'SEG São Cristóvão': 'SC',
  'SEG Lagos': 'LA',
  // Mantido para uma futura filial que possa ser cadastrada sem alterar o
  // formato dos números já emitidos.
  'SEG Vitória': 'VI'
});
const QUOTE_NUMBER_WIDTH = 5;
const DEFAULT_PHONES = `(21) 3081-8100 - TELEFONE DE ATENDIMENTO DA SEG JACAREPAGUÁ
(21) 3402-6070 - TELEFONE DE ATENDIMENTO DA SEG OESTE
(21) 3978-5454 - TELEFONE DE ATENDIMENTO DA SEG SÃO CRISTÓVÃO
(22) 2627-1073 - TELEFONE DE ATENDIMENTO DA SEG LAGOS`;

const CENTRAL_WHATSAPP = '552130818100';
const APP_VERSION = '5.9.14';
const PRODUCT_PHOTO_ASSETS = {
  '19467': 'assets/products/19467.webp',
  '19628': 'assets/products/19628.webp',
  '20689': 'assets/products/20689.webp',
  '21318': 'assets/products/21318.webp',
  '21467': 'assets/products/21467.webp'
};
const OFFICIAL_SOURCE_URLS = {
  seg: query => `https://suporte.segbr.com.br/hc/pt-br/search?utf8=%E2%9C%93&query=${encodeURIComponent(query)}`,
  hikvision: query => `https://www.hikvision.com/pt-br/search/?q=${encodeURIComponent(query)}`,
  jfl: query => `https://jflalarmes.com.br/?s=${encodeURIComponent(query)}`,
  ipec: query => `https://ipec.ind.br/?s=${encodeURIComponent(query)}`,
  garen: query => `https://garen.com.br/?s=${encodeURIComponent(query)}`
};
const PHOTO_DB_NAME = 'seg_vendas_media';
const PHOTO_DB_VERSION = 1;
const PHOTO_STORE = 'product_photos';
const LOGO_ASSETS = {
  technological: 'assets/logo-tecnologico.jpg',
  international: 'assets/logo-international.png',
  standard: 'assets/logo-seg.png'
};
const STORE_SALES_CONTACTS = {
  'Loja de JPA / SEG Matriz': [
    { name: 'Ludmila', phone: '5521964055882' },
    { name: 'Filipe Mores', phone: '5521964391556' },
    { name: 'Evelyn', phone: '5521964421030' },
    { name: 'Atendimento central SEG', phone: CENTRAL_WHATSAPP }
  ],
  'SEG Oeste (Campo Grande)': [{ name: 'Atendimento central SEG', phone: CENTRAL_WHATSAPP }],
  'SEG São Cristóvão': [{ name: 'Atendimento central SEG', phone: CENTRAL_WHATSAPP }],
  'SEG Lagos': [{ name: 'Atendimento central SEG', phone: CENTRAL_WHATSAPP }]
};

const BUILT_IN_MANUALS = [
  {
    id: 'app-guide',
    title: 'Guia de uso do aplicativo SEG Vendas',
    category: 'Outros',
    brand: 'SEG',
    models: 'SEG Vendas',
    description: 'Orientações básicas para pesquisar produtos, montar orçamentos, consultar manuais e participar do fórum.',
    url: 'GUIA_APLICATIVO.html',
    approved: true,
    updatedAt: '2026-07-29'
  }
];

const FORUM_SEED_TOPICS = [
  {
    id: 'topic-welcome',
    createdAt: '2026-07-28T12:00:00.000Z',
    author: 'Equipe SEG',
    role: 'Coordenador SEG',
    category: 'Outros',
    model: '',
    title: 'Como usar o fórum técnico com segurança',
    body: 'Informe o modelo do equipamento, tensão, sintomas e testes já realizados. Não publique senhas, CPF/CNPJ, endereços ou imagens que mostrem dados privados do cliente.',
    solved: true,
    helpful: 3,
    reports: 0,
    official: true,
    answers: [
      {
        id: 'answer-welcome',
        createdAt: '2026-07-28T12:05:00.000Z',
        author: 'Equipe SEG',
        role: 'Coordenador SEG',
        body: 'Respostas marcadas como “Oficial SEG” devem ter prioridade. Em situações de risco elétrico, incêndio, portão sem segurança mecânica ou dúvida de garantia, interrompa o serviço e procure o suporte oficial.',
        helpful: 2,
        official: true
      }
    ]
  },
  {
    id: 'topic-manual-request',
    createdAt: '2026-07-28T12:10:00.000Z',
    author: 'Moderador SEG',
    role: 'Coordenador SEG',
    category: 'Solicitação de manual',
    model: '',
    title: 'Não encontrou um manual? Solicite pelo código ou modelo',
    body: 'Abra uma dúvida nesta categoria e informe o código do produto, modelo e marca. A equipe poderá vincular o PDF oficial à biblioteca.',
    solved: false,
    helpful: 1,
    reports: 0,
    official: true,
    answers: []
  }
];

const FORUM_PROFILE_OPTIONS = Object.freeze([
  'Instalador',
  'Cliente',
  'Colaborador SEG',
  'Vendedor SEG',
  'Coordenador SEG',
  'Suporte técnico SEG',
  'Financeiro SEG',
  'Técnico / integrador',
  'Revendedor / parceiro',
  'Outro'
]);
const FORUM_SEG_PROFILES = new Set([
  'Colaborador SEG',
  'Vendedor SEG',
  'Coordenador SEG',
  'Suporte técnico SEG',
  'Financeiro SEG'
]);


const $ = id => document.getElementById(id);
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numberBR = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const productIndex = PRODUCTS.map((p, i) => ({
  i,
  code: String(p[0]),
  desc: String(p[1]),
  price: Number(p[2]) || 0,
  norm: normalize(`${p[0]} ${p[1]}`)
}));

let currentQuote = emptyQuote();
let toastTimer;
let deferredInstallPrompt = null;
let pendingSalesProduct = null;
let pendingPhotoProduct = null;
let photoDbPromise = null;
const productPhotoUrlCache = new Map();
let serverManuals = [];
let segHelpSearchState = { query: '', loading: false, error: '', results: [], searchedAt: '' };
let editingManualId = null;
let pendingManualFile = null;
let currentUser = null;
let authToken = '';
sessionStorage.removeItem('seg_auth_token');
localStorage.removeItem('seg_auth_token');
let serverPhotoIndex = {};
let serverPhotoAudit = [];
let pendingClientCsv = null;
let clientSearchTimer = null;
let currentQuoteStep = 1;


function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function parseBR(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = String(value ?? '').trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!text) return 0;
  if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '').replace(',', '.');
  else if (text.includes(',')) text = text.replace(',', '.');
  const result = Number(text);
  return Number.isFinite(result) ? result : 0;
}

function formatInputMoney(value) {
  return numberBR.format(Math.max(0, Number(value) || 0));
}

function nowISO() { return new Date().toISOString(); }
function localDateTime(iso = nowISO()) { return new Date(iso).toLocaleString('pt-BR'); }
function localDate(iso = nowISO()) { return new Date(iso).toLocaleDateString('pt-BR'); }

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sellersForStore(store) {
  return STORE_CONFIG[store] || [];
}

function sellerProfile(store, seller) {
  return sellersForStore(store).find(item => item.name === seller) || null;
}

function isPromotionQuote(quote = currentQuote) {
  return localDateKey(quote.createdAt || new Date()) === PROMOTION_DATE;
}

function discountPolicy(quote = currentQuote) {
  const profile = sellerProfile(quote.store, quote.seller);
  if (profile?.role === 'coordinator') {
    return { role: 'coordinator', max: 100, label: 'Coordenador: desconto livre', promotion: isPromotionQuote(quote) };
  }
  if (isPromotionQuote(quote)) {
    return { role: 'seller', max: PROMOTION_SELLER_DISCOUNT, label: 'Promoção de 31/07: vendedor pode aplicar até 8%', promotion: true };
  }
  return { role: 'seller', max: NORMAL_SELLER_DISCOUNT_MAX, label: 'Vendedor: desconto máximo de 4%', promotion: false };
}

function roleLabel(role) {
  return role === 'coordinator' ? 'Coordenador(a)' : 'Vendedor(a)';
}

function quotePrefixForStore(store) {
  if (QUOTE_PREFIXES[store]) return QUOTE_PREFIXES[store];
  const normalized = normalize(store);
  if (normalized.includes('oeste')) return 'OE';
  if (normalized.includes('cristovao')) return 'SC';
  if (normalized.includes('lagos')) return 'LA';
  if (normalized.includes('vitoria')) return 'VI';
  if (normalized.includes('matriz') || normalized.includes('jpa')) return 'MA';
  const initials = normalized.split(' ').filter(Boolean).map(word => word[0]).join('').toUpperCase();
  return (initials.slice(0, 2) || 'LO').padEnd(2, 'X');
}

function storedQuoteSequenceMax(prefix) {
  let highest = 0;
  const pattern = new RegExp(`^${prefix}(\\d+)$`, 'i');
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || '';
      if (key !== 'seg_quotes' && !key.startsWith('seg_quotes_')) continue;
      const history = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(history)) continue;
      history.forEach(item => {
        const match = pattern.exec(String(item?.number || ''));
        if (match) highest = Math.max(highest, Number(match[1]) || 0);
      });
    }
  } catch {
    // O histórico local não deve impedir a criação de um novo orçamento.
  }
  return highest;
}

function nextNumber(store) {
  const prefix = quotePrefixForStore(store || STORES[0]);
  const key = `seg_next_quote_number_${prefix}`;
  let next = Number(localStorage.getItem(key) || 0);
  if (!Number.isSafeInteger(next) || next < 1) next = storedQuoteSequenceMax(prefix) + 1;
  if (next < 1) next = 1;
  return `${prefix}${String(next).padStart(QUOTE_NUMBER_WIDTH, '0')}`;
}

function advanceQuoteNumber(number) {
  const match = /^([A-Z]{2})(\d+)$/.exec(String(number || '').toUpperCase());
  if (!match) return;
  const key = `seg_next_quote_number_${match[1]}`;
  const next = (Number(match[2]) || 0) + 1;
  const current = Number(localStorage.getItem(key) || 0);
  if (!Number.isSafeInteger(current) || current < next) localStorage.setItem(key, String(next));
}

function isStandardQuoteNumber(number, store) {
  const prefix = quotePrefixForStore(store || STORES[0]);
  return new RegExp(`^${prefix}\\d{${QUOTE_NUMBER_WIDTH},}$`, 'i').test(String(number || '').trim());
}

function emptyQuote() {
  const rememberedStore = localStorage.getItem('seg_last_store');
  const store = STORES.includes(rememberedStore) ? rememberedStore : STORES[0];
  const availableSellers = sellersForStore(store);
  const rememberedSeller = localStorage.getItem('seg_last_seller');
  const seller = availableSellers.some(item => item.name === rememberedSeller)
    ? rememberedSeller
    : availableSellers.find(item => item.role === 'seller')?.name || availableSellers[0]?.name || '';
  const profile = sellerProfile(store, seller);
  const createdAt = nowISO();
  const promotion = localDateKey(createdAt) === PROMOTION_DATE;
  return {
    id: null,
    number: nextNumber(store),
    createdAt,
    seller,
    sellerRole: profile?.role || 'seller',
    store,
    payment: 'À VISTA',
    validity: 7,
    client: { name: '', code: '', document: '', phone: '', ie: '', address: '', city: 'RIO DE JANEIRO', state: 'RJ' },
    items: [],
    discount: promotion && profile?.role !== 'coordinator' ? PROMOTION_SELLER_DISCOUNT : 0,
    discountHistory: [],
    freight: 0,
    notes: promotion ? 'Promoção Dia do Instalador — 8% de desconto válido somente em 31/07/2026.' : ''
  };
}

function quoteTotals(quote = currentQuote) {
  const subtotal = quote.items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0);
  const discountPct = Math.min(100, Math.max(0, Number(quote.discount) || 0));
  const discountValue = subtotal * discountPct / 100;
  const freight = Math.max(0, Number(quote.freight) || 0);
  return { subtotal, discountPct, discountValue, freight, total: subtotal - discountValue + freight };
}

function getSettings() {
  const defaults = { site: 'WWW.SEGBR.COM.BR', phones: DEFAULT_PHONES, logoChoice: 'standard', customLogoData: '', brandingVersion: 5 };
  try {
    const stored = JSON.parse(localStorage.getItem('seg_settings') || '{}');
    const settings = { ...defaults, ...stored };
    // Restaura a logo padrão anterior uma única vez ao abrir a versão 4.1.
    if (Number(settings.brandingVersion || 0) < 5) {
      if (settings.logoChoice !== 'custom' || !settings.customLogoData) settings.logoChoice = 'standard';
      settings.brandingVersion = 5;
      localStorage.setItem('seg_settings', JSON.stringify(settings));
    }
    return settings;
  } catch {
    return defaults;
  }
}

function getLogoSource(settings = getSettings()) {
  if (settings.logoChoice === 'custom' && settings.customLogoData) return settings.customLogoData;
  return LOGO_ASSETS[settings.logoChoice] || LOGO_ASSETS.standard;
}

function applyBranding() {
  const source = getLogoSource();
  $('appBrandLogo').src = source;
  $('logoPreview').src = source;
}

function updateLogoControls() {
  const settings = getSettings();
  $('logoChoiceSelect').value = settings.logoChoice || 'standard';
  $('customLogoLabel').classList.toggle('hidden', $('logoChoiceSelect').value !== 'custom');
  $('logoPreview').src = getLogoSource(settings);
}

let serverQuoteHistoryLoaded = false;
let serverQuoteHistorySyncing = false;

function historyOwnerKey() {
  const username = normalize(currentUser?.username || '').replace(/[^a-z0-9]/g, '');
  return username ? `seg_quotes_${username}` : 'seg_quotes';
}

function readStoredHistory(key = historyOwnerKey()) {
  try {
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(items) ? items : [];
  } catch { return []; }
}

function standardizeLocalQuoteNumbers(items) {
  if (!Array.isArray(items)) return { items: [], changed: false };
  let changed = false;
  const legacyIds = new Map();
  const standardized = items.map(item => {
    if (!item || typeof item !== 'object' || !item.id || isStandardQuoteNumber(item.number, item.store)) return item;
    const copy = { ...item };
    const oldNumber = String(item.number || '').trim();
    if (oldNumber) copy.legacyNumber = oldNumber;
    copy.number = nextNumber(item.store || STORES[0]);
    advanceQuoteNumber(copy.number);
    legacyIds.set(String(item.id), copy.number);
    changed = true;
    return copy;
  });
  standardized.forEach(item => {
    const reused = item?.reusedFrom;
    const replacement = reused?.id ? legacyIds.get(String(reused.id)) : '';
    if (replacement) item.reusedFrom = { ...reused, number: replacement };
  });
  return { items: standardized, changed };
}

function getHistory() {
  const key = historyOwnerKey();
  const result = standardizeLocalQuoteNumbers(readStoredHistory(key));
  if (result.changed) localStorage.setItem(key, JSON.stringify(result.items));
  return result.items;
}

function setHistory(items) {
  const result = standardizeLocalQuoteNumbers(Array.isArray(items) ? items : []);
  localStorage.setItem(historyOwnerKey(), JSON.stringify(result.items));
}

function mergeQuoteHistory(...groups) {
  const merged = new Map();
  groups.flat().filter(item => item && item.id).forEach(item => {
    const previous = merged.get(String(item.id));
    const previousStamp = String(previous?.updatedAt || previous?.createdAt || '');
    const nextStamp = String(item.updatedAt || item.createdAt || '');
    const sameStampServerWins = previous && nextStamp === previousStamp
      && item.serverSavedAt && (!previous.serverSavedAt || String(item.serverSavedAt) >= String(previous.serverSavedAt));
    if (!previous || nextStamp > previousStamp || sameStampServerWins) merged.set(String(item.id), item);
  });
  return [...merged.values()].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function syncQuoteHistoryWithServer({ silent = true } = {}) {
  if (!currentUser || !['seller', 'coordinator', 'admin'].includes(currentUser.role) || serverQuoteHistorySyncing) return;
  serverQuoteHistorySyncing = true;
  const marker = 'seg_quotes_migrated_578';
  const localHistory = getHistory();
  const legacyRaw = localStorage.getItem(marker) ? [] : readStoredHistory('seg_quotes');
  const legacyResult = standardizeLocalQuoteNumbers(legacyRaw);
  const legacyHistory = legacyResult.items;
  if (legacyResult.changed) localStorage.setItem('seg_quotes', JSON.stringify(legacyHistory));
  const currentOwner = normalize(currentUser.username || '').replace(/[^a-z0-9]/g, '');
  const outgoing = mergeQuoteHistory(localHistory, legacyHistory).filter(item => {
    const savedOwner = normalize(item.ownerUsername || '').replace(/[^a-z0-9]/g, '');
    return !savedOwner || savedOwner === currentOwner;
  });
  try {
    const options = outgoing.length
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quotes: outgoing.slice(0, 500) }) }
      : { cache: 'no-store' };
    const response = await apiFetch('/api/quote-history', options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível sincronizar o histórico.');
    setHistory(mergeQuoteHistory(data.history || [], outgoing));
    serverQuoteHistoryLoaded = true;
    if (legacyHistory.length) localStorage.setItem(marker, nowISO());
    renderHistory();
  } catch (error) {
    if (!silent) showToast(error.message || 'Histórico salvo neste aparelho; sincronização pendente');
  } finally {
    serverQuoteHistorySyncing = false;
  }
}

async function persistQuoteOnServer(quote, silent = true) {
  if (!currentUser || !['seller', 'coordinator', 'admin'].includes(currentUser.role)) return;
  try {
    const response = await apiFetch('/api/quote-history', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quote })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível guardar o pedido no servidor.');
    setHistory(mergeQuoteHistory(data.history || [], getHistory()));
    const savedQuote = (data.history || []).find(item => String(item?.id || '') === String(quote.id));
    if (savedQuote?.number) {
      // O servidor local é a autoridade final da sequência. Isso corrige a
      // prévia criada no navegador caso outro terminal já tenha usado o mesmo
      // número enquanto este estava offline.
      advanceQuoteNumber(savedQuote.number);
      if (String(currentQuote.id || '') === String(quote.id)) {
        currentQuote.number = savedQuote.number;
        $('quoteNumberBadge').textContent = `Nº ${savedQuote.number}`;
      }
    }
    serverQuoteHistoryLoaded = true;
    renderHistory();
  } catch (error) {
    if (!silent) showToast('Pedido salvo neste aparelho; será sincronizado quando o servidor estiver disponível');
  }
}

function showToast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}


function isCurrentCoordinator() {
  return sellerProfile(currentQuote.store, currentQuote.seller)?.role === 'coordinator';
}

function openPhotoDb() {
  if (photoDbPromise) return photoDbPromise;
  photoDbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB não disponível'));
      return;
    }
    const request = indexedDB.open(PHOTO_DB_NAME, PHOTO_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE, { keyPath: 'code' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao abrir banco de fotos'));
  });
  return photoDbPromise;
}

async function readPhotoRecord(code) {
  try {
    const db = await openPhotoDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(PHOTO_STORE, 'readonly').objectStore(PHOTO_STORE).get(String(code));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function writePhotoRecord(record) {
  const db = await openPhotoDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(PHOTO_STORE, 'readwrite').objectStore(PHOTO_STORE).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function clearProductPhotoCache(code) {
  const cached = productPhotoUrlCache.get(String(code));
  if (cached?.objectUrl) URL.revokeObjectURL(cached.url);
  productPhotoUrlCache.delete(String(code));
}

async function getProductPhotoState(code) {
  const normalizedCode = String(code);
  const record = await readPhotoRecord(normalizedCode);
  if (record?.hidden) return { source: 'none', url: '', record };
  if (record?.blob instanceof Blob) {
    const signature = `${record.updatedAt || ''}-${record.blob.size}`;
    const cached = productPhotoUrlCache.get(normalizedCode);
    if (cached?.signature === signature) return { source: 'custom', url: cached.url, record };
    clearProductPhotoCache(normalizedCode);
    const url = URL.createObjectURL(record.blob);
    productPhotoUrlCache.set(normalizedCode, { url, signature, objectUrl: true });
    return { source: 'custom', url, record };
  }
  const bundled = PRODUCT_PHOTO_ASSETS[normalizedCode];
  if (bundled) return { source: 'bundled', url: bundled, record: null };
  return { source: 'none', url: '', record: null };
}

async function optimizeProductPhoto(file) {
  const image = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
    img.src = url;
  });
  const maxSide = 1200;
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  try {
    return await canvasBlob(canvas, 'image/webp', .84);
  } catch {
    return canvasBlob(canvas, 'image/jpeg', .88);
  }
}

function getPhotoAudit() {
  try {
    const value = JSON.parse(localStorage.getItem('seg_photo_audit') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function addPhotoAudit(action, product, details = '') {
  const audit = getPhotoAudit();
  audit.unshift({
    id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    code: String(product.code),
    description: product.desc || product.description || '',
    coordinator: currentQuote.seller,
    store: currentQuote.store,
    recordedAt: nowISO(),
    details
  });
  localStorage.setItem('seg_photo_audit', JSON.stringify(audit.slice(0, 500)));
}

function renderPhotoPermissions() {
  const coordinator = isCurrentCoordinator();
  const badge = $('photoPermissionBadge');
  const text = $('photoPermissionText');
  if (badge) {
    badge.textContent = coordinator ? 'Coordenador — edição liberada' : 'Somente visualização';
    badge.classList.toggle('coordinator', coordinator);
  }
  if (text) {
    text.textContent = coordinator
      ? `${currentQuote.seller} pode adicionar, substituir e remover fotos. Todas as alterações ficam registradas.`
      : 'O perfil atual pode visualizar as imagens, mas não pode adicionar, trocar, remover ou consultar o relatório de edições.';
  }
  $('photoAuditCard')?.classList.toggle('hidden', !coordinator);
  if (coordinator) renderPhotoAudit();
}

function renderPhotoAudit() {
  const list = $('photoAuditList');
  if (!list || !isCurrentCoordinator()) return;
  const audit = getPhotoAudit();
  if (!audit.length) {
    list.className = 'audit-list empty-state compact';
    list.textContent = 'Nenhuma alteração registrada.';
    return;
  }
  list.className = 'audit-list';
  list.innerHTML = audit.slice(0, 100).map(entry => `<article class="audit-item">
    <div><span class="audit-action">${escapeHtml(entry.action)}</span><strong>Cód. ${escapeHtml(entry.code)} — ${escapeHtml(entry.description)}</strong></div>
    <p>${escapeHtml(entry.coordinator)} · ${escapeHtml(entry.store)} · ${escapeHtml(localDateTime(entry.recordedAt))}</p>
    ${entry.details ? `<small>${escapeHtml(entry.details)}</small>` : ''}
  </article>`).join('');
}

function exportPhotoAudit() {
  if (!isCurrentCoordinator()) { showToast('Acesso exclusivo de coordenadores'); return; }
  const audit = getPhotoAudit();
  if (!audit.length) { showToast('Não há alterações para exportar'); return; }
  const quoteCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['Ação','Código','Produto','Coordenador','Loja','Data e hora','Detalhes'],
    ...audit.map(entry => [entry.action,entry.code,entry.description,entry.coordinator,entry.store,localDateTime(entry.recordedAt),entry.details || ''])
  ].map(row => row.map(quoteCsv).join(';'));
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `relatorio-edicao-fotos-seg-${new Date().toISOString().slice(0,10)}.csv`);
}

function productMediaHtml(product) {
  const editButton = isCurrentCoordinator()
    ? `<button class="photo-edit-btn" data-edit-photo-index="${product.i}" type="button" title="Editar foto" aria-label="Editar foto do produto">📷</button>`
    : '';
  return `<div class="product-media" data-photo-holder="${escapeHtml(product.code)}">
    <button class="product-photo-view" data-view-photo-index="${product.i}" type="button" aria-label="Visualizar foto do produto">
      <img class="product-thumb hidden" data-photo-img="${escapeHtml(product.code)}" alt="Foto do produto ${escapeHtml(product.code)}">
      <span class="product-photo-placeholder" data-photo-placeholder="${escapeHtml(product.code)}">SEG</span>
    </button>
    ${editButton}
  </div>`;
}

async function hydrateProductPhotos(container) {
  if (!container) return;
  const holders = [...container.querySelectorAll('[data-photo-holder]')];
  await Promise.all(holders.map(async holder => {
    const code = holder.dataset.photoHolder;
    const img = holder.querySelector('[data-photo-img]');
    const placeholder = holder.querySelector('[data-photo-placeholder]');
    const state = await getProductPhotoState(code);
    if (!holder.isConnected) return;
    if (state.url) {
      img.src = state.url;
      img.classList.remove('hidden');
      placeholder.classList.add('hidden');
      holder.classList.add('has-photo');
    } else {
      img.removeAttribute('src');
      img.classList.add('hidden');
      placeholder.classList.remove('hidden');
      holder.classList.remove('has-photo');
    }
  }));
}

function bindProductMediaEvents(container) {
  container.querySelectorAll('[data-view-photo-index]').forEach(button => {
    button.addEventListener('click', () => openProductPhotoModal(Number(button.dataset.viewPhotoIndex), false));
  });
  container.querySelectorAll('[data-edit-photo-index]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openProductPhotoModal(Number(button.dataset.editPhotoIndex), true);
    });
  });
}

async function openProductPhotoModal(index, requestEdit = false) {
  const product = productIndex.find(item => item.i === index);
  if (!product) return;
  pendingPhotoProduct = product;
  const state = await getProductPhotoState(product.code);
  $('productPhotoTitle').textContent = state.url ? 'Foto do produto' : 'Produto sem foto';
  $('productPhotoSummary').innerHTML = `<span>CÓD. ${escapeHtml(product.code)}</span><strong>${escapeHtml(product.desc)}</strong><b>${money.format(product.price)}</b>`;
  const preview = $('productPhotoPreview');
  if (state.url) {
    preview.src = state.url;
    preview.classList.remove('hidden');
    preview.alt = `Foto do produto ${product.code}`;
    $('productPhotoEmpty').classList.add('hidden');
  } else {
    preview.removeAttribute('src');
    preview.classList.add('hidden');
    preview.alt = 'Produto sem foto cadastrada';
    $('productPhotoEmpty').classList.remove('hidden');
  }
  const coordinator = isCurrentCoordinator();
  $('photoCoordinatorActions').classList.toggle('hidden', !coordinator);
  $('removeProductPhotoBtn').disabled = !state.url;
  $('photoModalHelp').textContent = coordinator
    ? 'Somente coordenadores podem alterar imagens. A edição será registrada no relatório.'
    : 'Foto disponível apenas para visualização. Edição exclusiva de coordenadores.';
  $('productPhotoModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  if (requestEdit && coordinator && !state.url) setTimeout(() => $('photoFileInput').click(), 120);
}

async function handleProductPhotoUpload(file) {
  if (!pendingPhotoProduct || !isCurrentCoordinator()) { showToast('Acesso exclusivo de coordenadores'); return; }
  if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) { showToast('Escolha uma imagem JPG, PNG ou WEBP'); return; }
  if (file.size > 10_000_000) { showToast('A imagem deve ter no máximo 10 MB'); return; }
  showToast('Otimizando e salvando a foto…');
  try {
    const previous = await getProductPhotoState(pendingPhotoProduct.code);
    const blob = await optimizeProductPhoto(file);
    await writePhotoRecord({
      code: String(pendingPhotoProduct.code),
      blob,
      hidden: false,
      fileName: file.name,
      updatedAt: nowISO(),
      updatedBy: currentQuote.seller,
      store: currentQuote.store
    });
    clearProductPhotoCache(pendingPhotoProduct.code);
    addPhotoAudit(previous.url ? 'Substituição' : 'Adição', pendingPhotoProduct, `Arquivo: ${file.name}`);
    renderPhotoAudit();
    refreshVisibleProductResults();
    await openProductPhotoModal(pendingPhotoProduct.i, false);
    showToast('Foto salva com sucesso');
  } catch (error) {
    console.error(error);
    showToast('Não foi possível salvar a foto neste aparelho');
  } finally {
    $('photoFileInput').value = '';
    if ($('photoCameraInput')) $('photoCameraInput').value = '';
  }
}

async function removePendingProductPhoto() {
  if (!pendingPhotoProduct || !isCurrentCoordinator()) { showToast('Acesso exclusivo de coordenadores'); return; }
  if (!window.confirm('Remover a foto deste produto?')) return;
  try {
    await writePhotoRecord({
      code: String(pendingPhotoProduct.code),
      hidden: true,
      updatedAt: nowISO(),
      updatedBy: currentQuote.seller,
      store: currentQuote.store
    });
    clearProductPhotoCache(pendingPhotoProduct.code);
    addPhotoAudit('Remoção', pendingPhotoProduct);
    renderPhotoAudit();
    refreshVisibleProductResults();
    await openProductPhotoModal(pendingPhotoProduct.i, false);
    showToast('Foto removida');
  } catch (error) {
    console.error(error);
    showToast('Não foi possível remover a foto');
  }
}

function refreshVisibleProductResults() {
  if ($('quoteSearchInput')?.value.trim()) renderSearch('quoteSearchInput','quoteSearchClear','quoteSearchResults','quote');
  if ($('catalogSearchInput')?.value.trim()) renderSearch('catalogSearchInput','catalogSearchClear','catalogResults','catalog');
}

function currentSupportQuery() {
  return $('manualSearchInput')?.value.trim() || '';
}

function updateOfficialSourceHint() {
  const query = currentSupportQuery();
  const hint = $('officialSourceHint');
  if (hint) hint.textContent = query
    ? `Pesquisa atual: “${query}”. Comece pela Central de Ajuda SEG.`
    : 'Digite uma pesquisa acima para abrir as fontes com a consulta preenchida.';
}

function openOfficialSource(source) {
  const query = currentSupportQuery();
  if (normalize(query).length < 2) {
    showToast('Digite o código, modelo ou dúvida antes de pesquisar');
    $('manualSearchInput')?.focus();
    return;
  }
  const buildUrl = OFFICIAL_SOURCE_URLS[source];
  if (!buildUrl) return;
  window.open(buildUrl(query), '_blank', 'noopener');
}

function openSupportWhatsapp() {
  const query = currentSupportQuery() || 'Não encontrei a orientação necessária';
  const message = [
    'Olá! Vim pela Central Técnica do aplicativo SEG Vendas.',
    '',
    `Minha dúvida / pesquisa: ${query}`,
    `Loja de preferência: ${currentQuote.store || 'Não informada'}`,
    '',
    'Gostaria de falar com o atendimento da SEG.'
  ].join('\n');
  window.open(`https://wa.me/${CENTRAL_WHATSAPP}?text=${encodeURIComponent(message)}`, '_blank');
}

function searchProducts(query, limit = 50) {
  const raw = String(query || '').trim();
  const q = normalize(raw);
  if (q.length < 2) return [];
  const tokens = q.split(' ').filter(Boolean);
  const exactCode = raw.replace(/\D/g, '');
  const eanMap = typeof EAN_MAP !== 'undefined' ? EAN_MAP : {};
  const eanCode = exactCode && eanMap[exactCode] ? String(eanMap[exactCode]) : '';
  const scored = [];
  for (const p of productIndex) {
    let score = 0;
    if (eanCode && p.code === eanCode) score += 5000;
    else if (exactCode && p.code === exactCode) score += 2000;
    else if (exactCode && p.code.startsWith(exactCode)) score += 900;
    if (p.norm === q) score += 800;
    if (p.norm.includes(q)) score += 500;
    let matched = 0;
    for (const token of tokens) {
      if (p.norm.includes(token)) matched++;
      else { matched = -99; break; }
    }
    if (matched > 0) score += matched * 100;
    if (score > 0) scored.push([score, p]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].desc.localeCompare(b[1].desc));
  return scored.slice(0, limit).map(entry => entry[1]);
}

function productCard(product, mode = 'quote') {
  const addLabel = mode === 'catalog' ? 'Adicionar' : '+';
  const contactButton = mode === 'catalog'
    ? `<button class="sales-contact-btn" data-sales-product-index="${product.i}" type="button">Falar com vendedor</button>`
    : '';
  return `<article class="product-row product-row-with-photo">
    ${productMediaHtml(product)}
    <div class="product-copy">
      <span class="product-code">CÓD. ${escapeHtml(product.code)}</span>
      <div class="product-desc">${escapeHtml(product.desc)}</div>
      <div class="product-price">${money.format(product.price)}</div>
    </div>
    <div class="product-actions">
      <button class="add-product-btn" data-product-index="${product.i}" type="button">${addLabel}</button>
      ${contactButton}
    </div>
  </article>`;
}

function renderSearch(inputId, clearId, resultsId, mode) {
  const input = $(inputId);
  const clear = $(clearId);
  const results = $(resultsId);
  const query = input.value.trim();
  clear.classList.toggle('hidden', !query);
  if (normalize(query).length < 2) {
    results.className = mode === 'catalog' ? 'catalog-results empty-state' : 'search-results empty-state compact';
    results.textContent = 'Digite ao menos 2 caracteres para pesquisar.';
    return;
  }
  const found = searchProducts(query, mode === 'catalog' ? 80 : 30);
  results.className = mode === 'catalog' ? 'catalog-results' : 'search-results';
  if (!found.length) {
    results.classList.add('empty-state');
    results.textContent = 'Nenhum produto encontrado.';
    return;
  }
  results.innerHTML = found.map(p => productCard(p, mode)).join('');
  results.querySelectorAll('[data-product-index]').forEach(button => {
    button.addEventListener('click', () => addProduct(Number(button.dataset.productIndex)));
  });
  results.querySelectorAll('[data-sales-product-index]').forEach(button => {
    button.addEventListener('click', () => openSalesContact(Number(button.dataset.salesProductIndex)));
  });
  bindProductMediaEvents(results);
  hydrateProductPhotos(results);
}

function addProduct(index) {
  const product = productIndex.find(p => p.i === index);
  if (!product) return;
  const existing = currentQuote.items.find(item => item.code === product.code);
  if (existing) existing.qty = (Number(existing.qty) || 0) + 1;
  else currentQuote.items.push({ code: product.code, description: product.desc, qty: 1, unitPrice: product.price });
  renderCart();
  showToast(`Produto ${product.code} adicionado`);
}

function removeProduct(index) {
  currentQuote.items.splice(index, 1);
  renderCart();
}

function warrantySealSlots(item) {
  return Math.min(300, Math.max(0, Math.floor(Number(item?.qty) || 0)));
}

function filledWarrantySeals(item) {
  return (Array.isArray(item?.warrantySeals) ? item.warrantySeals : [])
    .slice(0, warrantySealSlots(item))
    .map((value, unit) => ({ unit: unit + 1, value: String(value || '').trim() }))
    .filter(entry => entry.value);
}

function warrantySealsText(item) {
  const seals = filledWarrantySeals(item);
  return seals.length ? seals.map(entry => `Un. ${entry.unit}: ${entry.value}`).join(' · ') : '';
}

function closeWarrantySealsModal() {
  $('warrantySealsModal')?.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function openWarrantySealsModal(index) {
  const item = currentQuote.items[index];
  if (!item) return;
  const slots = warrantySealSlots(item);
  if (!slots) { showToast('Informe uma quantidade inteira para adicionar selos.'); return; }
  if ((Number(item.qty) || 0) > 300) showToast('É possível registrar até 300 selos por item.');
  let modal = $('warrantySealsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'warrantySealsModal';
    modal.className = 'modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `<div class="modal-backdrop" data-close-warranty-seals></div><div class="modal-sheet warranty-seals-sheet">
      <div class="modal-head"><div><p class="eyebrow">GARANTIA OPCIONAL</p><h2>Selos de garantia</h2><p class="muted" id="warrantySealsSummary"></p></div><button class="modal-close" data-close-warranty-seals type="button">×</button></div>
      <p class="notice">Preencha apenas os selos utilizados. Os campos podem permanecer vazios.</p>
      <form id="warrantySealsForm"><div class="warranty-seals-grid" id="warrantySealsFields"></div><div class="warranty-seals-actions"><button class="btn ghost" id="clearWarrantySealsBtn" type="button">Limpar selos</button><button class="btn primary" type="submit">Salvar selos</button></div></form>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close-warranty-seals]').forEach(button => button.addEventListener('click', closeWarrantySealsModal));
    $('clearWarrantySealsBtn').addEventListener('click', () => modal.querySelectorAll('[data-warranty-seal]').forEach(input => { input.value = ''; }));
    $('warrantySealsForm').addEventListener('submit', event => {
      event.preventDefault();
      const itemIndex = Number(modal.dataset.itemIndex);
      const target = currentQuote.items[itemIndex];
      if (!target) return closeWarrantySealsModal();
      const values = [...modal.querySelectorAll('[data-warranty-seal]')].map(input => input.value.trim().slice(0, 120));
      const otherValues = currentQuote.items.flatMap((other, otherIndex) => otherIndex === itemIndex ? [] : filledWarrantySeals(other).map(entry => entry.value.toLocaleLowerCase('pt-BR')));
      const filled = values.filter(Boolean).map(value => value.toLocaleLowerCase('pt-BR'));
      const duplicates = filled.filter((value, position) => filled.indexOf(value) !== position || otherValues.includes(value));
      if (duplicates.length) { showToast('Cada selo deve ser único no orçamento.'); return; }
      target.warrantySeals = values;
      closeWarrantySealsModal();
      renderCart();
      showToast(values.some(Boolean) ? 'Selos de garantia salvos' : 'Selos removidos do produto');
    });
  }
  modal.dataset.itemIndex = String(index);
  $('warrantySealsSummary').textContent = `${item.code} — ${item.description} · ${slots} unidade${slots === 1 ? '' : 's'}`;
  const previous = Array.isArray(item.warrantySeals) ? item.warrantySeals : [];
  $('warrantySealsFields').innerHTML = Array.from({ length: slots }, (_, unit) => `<label>Unidade ${unit + 1}<input data-warranty-seal maxlength="120" autocomplete="off" value="${escapeHtml(previous[unit] || '')}" placeholder="Número do selo (opcional)"></label>`).join('');
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(() => modal.querySelector('[data-warranty-seal]')?.focus(), 60);
}

function renderCart() {
  const list = $('cartList');
  const count = currentQuote.items.length;
  $('cartCountLabel').textContent = count ? `${count} ${count === 1 ? 'item' : 'itens'}` : 'Nenhum item';
  if (!count) {
    list.className = 'cart-list empty-state';
    list.textContent = 'Adicione um produto para começar.';
    renderTotals();
    refreshQuoteGuideState();
    return;
  }
  list.className = 'cart-list';
  list.innerHTML = currentQuote.items.map((item, index) => {
    const product = productIndex.find(entry => entry.code === String(item.code));
    const media = product
      ? productMediaHtml(product)
      : '<div class="product-media"><div class="product-photo-view"><span class="product-photo-placeholder">SEG</span></div></div>';
    const seals = filledWarrantySeals(item);
    const sealSlots = warrantySealSlots(item);
    const sealSummary = seals.length ? `<span class="warranty-seal-count">${seals.length}/${sealSlots} preenchido${seals.length === 1 ? '' : 's'}</span>` : '<span class="warranty-seal-count empty">Uso facultativo</span>';
    return `<article class="cart-item cart-item-with-photo">
      ${media}
      <div class="cart-item-body">
        <div class="cart-item-top">
          <div>
            <div class="cart-item-code">CÓD. ${escapeHtml(item.code)}</div>
            <div class="cart-item-title">${escapeHtml(item.description)}</div>
          </div>
          <button class="remove-item" type="button" data-remove-index="${index}" title="Remover">×</button>
        </div>
        <div class="cart-controls">
          <label>Quantidade
            <input type="number" min="0.01" step="0.01" inputmode="decimal" value="${Number(item.qty)}" data-qty-index="${index}">
          </label>
          <label>Valor unitário
            <input type="text" inputmode="decimal" value="${formatInputMoney(item.unitPrice)}" data-price-index="${index}">
          </label>
          <div class="line-total">${money.format((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}</div>
        </div>
        <div class="warranty-seal-row"><button class="btn secondary compact-btn" type="button" data-warranty-seals-index="${index}">Adicionar selo</button>${sealSummary}</div>
      </div>
    </article>`;
  }).join('');

  list.querySelectorAll('[data-remove-index]').forEach(el => el.addEventListener('click', () => removeProduct(Number(el.dataset.removeIndex))));
  list.querySelectorAll('[data-warranty-seals-index]').forEach(el => el.addEventListener('click', () => openWarrantySealsModal(Number(el.dataset.warrantySealsIndex))));
  list.querySelectorAll('[data-qty-index]').forEach(el => el.addEventListener('input', () => {
    const item = currentQuote.items[Number(el.dataset.qtyIndex)];
    item.qty = Math.max(0, parseBR(el.value));
    if (Array.isArray(item.warrantySeals)) item.warrantySeals = item.warrantySeals.slice(0, warrantySealSlots(item));
    renderCart();
  }));
  list.querySelectorAll('[data-price-index]').forEach(el => {
    el.addEventListener('change', () => {
      currentQuote.items[Number(el.dataset.priceIndex)].unitPrice = Math.max(0, parseBR(el.value));
      renderCart();
    });
    el.addEventListener('focus', () => el.select());
  });
  bindProductMediaEvents(list);
  hydrateProductPhotos(list);
  renderTotals();
  refreshQuoteGuideState();
}

function renderTotals() {
  const totals = quoteTotals();
  $('subtotalValue').textContent = money.format(totals.subtotal);
  $('discountValue').textContent = `- ${money.format(totals.discountValue)}`;
  $('freightValue').textContent = money.format(totals.freight);
  $('grandTotalValue').textContent = money.format(totals.total);
}

function populateSellerSelect(store, preferredSeller = '') {
  const sellers = sellersForStore(store);
  $('sellerSelect').innerHTML = sellers.map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}${item.role === 'coordinator' ? ' — Coordenador(a)' : ''}</option>`).join('');
  const selected = sellers.some(item => item.name === preferredSeller)
    ? preferredSeller
    : sellers.find(item => item.role === 'seller')?.name || sellers[0]?.name || '';
  $('sellerSelect').value = selected;
  return selected;
}

function updateDiscountPolicyUI({ clamp = true, applyPromotion = false } = {}) {
  currentQuote.store = $('storeSelect').value || currentQuote.store;
  currentQuote.seller = $('sellerSelect').value || currentQuote.seller;
  const profile = sellerProfile(currentQuote.store, currentQuote.seller);
  currentQuote.sellerRole = profile?.role || 'seller';
  const policy = discountPolicy(currentQuote);
  const input = $('discountInput');
  input.max = String(policy.max);
  $('sellerRoleBadge').textContent = roleLabel(policy.role);
  $('sellerRoleBadge').classList.toggle('coordinator', policy.role === 'coordinator');
  $('discountPolicyHint').textContent = policy.label;
  $('promotionBanner').classList.toggle('hidden', !policy.promotion);
  if (applyPromotion && policy.promotion && policy.role === 'seller' && parseBR(input.value) === 0) {
    input.value = PROMOTION_SELLER_DISCOUNT;
  }
  const entered = parseBR(input.value);
  if (clamp && policy.role !== 'coordinator' && entered > policy.max) {
    input.value = policy.max;
    currentQuote.discount = policy.max;
    showToast(`Limite de desconto: ${numberBR.format(policy.max)}%`);
  } else {
    currentQuote.discount = Math.min(100, Math.max(0, entered));
  }
  renderTotals();
}

function registerDiscountAudit() {
  currentQuote.discountHistory = Array.isArray(currentQuote.discountHistory) ? currentQuote.discountHistory : [];
  const entry = {
    seller: currentQuote.seller,
    role: currentQuote.sellerRole || sellerProfile(currentQuote.store, currentQuote.seller)?.role || 'seller',
    store: currentQuote.store,
    percentage: Number(currentQuote.discount) || 0,
    recordedAt: nowISO(),
    promotion: isPromotionQuote(currentQuote)
  };
  const last = currentQuote.discountHistory[currentQuote.discountHistory.length - 1];
  const changed = !last || last.seller !== entry.seller || last.role !== entry.role || last.store !== entry.store || Number(last.percentage) !== entry.percentage || Boolean(last.promotion) !== entry.promotion;
  if (changed) currentQuote.discountHistory.push(entry);
  currentQuote.discountAuthorizedBy = entry;
}

function syncFormToQuote() {
  currentQuote.store = $('storeSelect').value;
  currentQuote.seller = $('sellerSelect').value;
  currentQuote.sellerRole = sellerProfile(currentQuote.store, currentQuote.seller)?.role || 'seller';
  currentQuote.payment = $('paymentSelect').value;
  currentQuote.validity = Number($('validitySelect').value) || 7;
  currentQuote.client = {
    name: $('clientName').value.trim(),
    code: $('clientCode').value.trim(),
    document: $('clientDocument').value.trim(),
    phone: $('clientPhone').value.trim(),
    ie: $('clientIE').value.trim(),
    address: $('clientAddress').value.trim(),
    city: $('clientCity').value.trim(),
    state: $('clientState').value.trim().toUpperCase()
  };
  currentQuote.discount = Math.min(100, Math.max(0, parseBR($('discountInput').value)));
  currentQuote.freight = Math.max(0, parseBR($('freightInput').value));
  currentQuote.notes = $('notesInput').value.trim();
  localStorage.setItem('seg_last_seller', currentQuote.seller);
  localStorage.setItem('seg_last_store', currentQuote.store);
}

function populateQuoteForm() {
  $('quoteNumberBadge').textContent = `Nº ${currentQuote.number}`;
  $('quoteDateLabel').textContent = localDateTime(currentQuote.createdAt);
  $('storeSelect').value = STORES.includes(currentQuote.store) ? currentQuote.store : STORES[0];
  currentQuote.store = $('storeSelect').value;
  currentQuote.seller = populateSellerSelect(currentQuote.store, currentQuote.seller);
  currentQuote.sellerRole = sellerProfile(currentQuote.store, currentQuote.seller)?.role || 'seller';
  $('paymentSelect').value = currentQuote.payment;
  $('validitySelect').value = String(currentQuote.validity || 7);
  $('clientName').value = currentQuote.client.name || '';
  $('clientCode').value = currentQuote.client.code || '';
  $('clientDocument').value = currentQuote.client.document || '';
  $('clientPhone').value = currentQuote.client.phone || '';
  $('clientIE').value = currentQuote.client.ie || '';
  $('clientAddress').value = currentQuote.client.address || '';
  $('clientCity').value = currentQuote.client.city || '';
  $('clientState').value = currentQuote.client.state || '';
  $('discountInput').value = currentQuote.discount || 0;
  $('freightInput').value = formatInputMoney(currentQuote.freight || 0);
  $('notesInput').value = currentQuote.notes || '';
  updateDiscountPolicyUI({ clamp: true, applyPromotion: false });
  renderPhotoPermissions();
  renderCart();
}

function validateQuote() {
  syncFormToQuote();
  const policy = discountPolicy(currentQuote);
  if (policy.role !== 'coordinator' && currentQuote.discount > policy.max) {
    showToast(`Este vendedor pode aplicar no máximo ${numberBR.format(policy.max)}% de desconto`);
    $('discountInput').focus();
    return false;
  }
  if (!currentQuote.items.length) { showToast('Adicione ao menos um produto'); $('quoteSearchInput').focus(); return false; }
  return true;
}

function prepareQuoteForSend() {
  if (!validateQuote()) return null;
  const quote = structuredClone(currentQuote);
  if (!quote.client?.name?.trim()) quote.client.name = 'Cliente não informado';
  return quote;
}

function saveQuote(silent = false) {
  if (!validateQuote()) return false;
  syncFormToQuote();
  if (!currentQuote.client.name.trim()) { showToast('Informe o nome do cliente para salvar'); $('clientName').focus(); return false; }
  registerDiscountAudit();
  const history = getHistory();
  const isNew = !currentQuote.id;
  if (isNew) currentQuote.id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  currentQuote.updatedAt = nowISO();
  const index = history.findIndex(q => q.id === currentQuote.id);
  if (index >= 0) history[index] = structuredClone(currentQuote);
  else history.unshift(structuredClone(currentQuote));
  setHistory(history);
  persistQuoteOnServer(structuredClone(currentQuote), silent);
  if (isNew) advanceQuoteNumber(currentQuote.number);
  renderHistory();
  if (!silent) showToast('Orçamento salvo');
  return true;
}

function newQuote(confirmFirst = true) {
  if (confirmFirst && currentQuote.items.length && !window.confirm('Começar um novo orçamento? Os dados não salvos serão descartados.')) return;
  currentQuote = emptyQuote();
  populateQuoteForm();
  $('quoteSearchInput').value = '';
  renderSearch('quoteSearchInput','quoteSearchClear','quoteSearchResults','quote');
  switchPage('quote');
  showQuoteStep(1, { scroll: false, focus: false });
}

function loadQuote(id) {
  const quote = getHistory().find(q => q.id === id);
  if (!quote) return;
  currentQuote = structuredClone(quote);
  populateQuoteForm();
  switchPage('quote');
  showQuoteStep(1, { scroll: false, focus: false });
  showToast(`Orçamento ${quote.number} aberto`);
}

function deleteQuote(id) {
  showToast('Os pedidos do histórico são preservados e não podem ser excluídos');
}

function reuseQuote(id) {
  const source = getHistory().find(q => q.id === id);
  if (!source) return;
  if (currentQuote.items.length && !window.confirm('Criar um novo orçamento com este pedido? Os dados ainda não salvos do orçamento atual serão substituídos.')) return;
  const reused = emptyQuote();
  if (currentUser?.role === 'seller' || currentUser?.role === 'coordinator') {
    reused.store = currentUser.store;
    reused.seller = currentUser.name;
    reused.sellerRole = currentUser.role;
  } else if (currentUser?.role === 'admin') {
    reused.store = currentUser.store || source.store || reused.store;
    reused.seller = currentUser.name;
    reused.sellerRole = 'admin';
  }
  reused.client = structuredClone(source.client || reused.client);
  reused.items = structuredClone(source.items || []).map(item => ({ ...item, warrantySeals: [] }));
  reused.payment = source.payment || reused.payment;
  reused.validity = Number(source.validity) || reused.validity;
  reused.discount = Number(source.discount) || 0;
  reused.freight = Number(source.freight) || 0;
  reused.notes = source.notes || '';
  reused.reusedFrom = { id: source.id, number: source.number };
  currentQuote = reused;
  populateQuoteForm();
  switchPage('quote');
  showQuoteStep(3, { scroll: true, focus: false });
  showToast(`Nova cópia criada a partir do pedido ${source.number}. Confira os preços antes de salvar.`);
}

function quoteStatusOf(quote) {
  return ['sale', 'delivery'].includes(quote?.status) ? quote.status : 'quote';
}

function quoteStamp(quote) {
  return quote?.soldAt || quote?.updatedAt || quote?.createdAt || '';
}

function historyFilterValues() {
  const value = id => $(id)?.value.trim() || '';
  return {
    seller: value('historySellerFilter'),
    status: value('historyStatusFilter'),
    client: normalize(value('historyClientFilter')),
    number: value('historyNumberFilter').replace(/[^a-z0-9]/gi, '').toUpperCase(),
    product: normalize(value('historyProductFilter')),
    startDate: value('historyStartDateFilter'),
    endDate: value('historyEndDateFilter'),
    startTime: value('historyStartTimeFilter'),
    endTime: value('historyEndTimeFilter'),
    minValue: value('historyMinValueFilter') ? parseBR(value('historyMinValueFilter')) : null,
    maxValue: value('historyMaxValueFilter') ? parseBR(value('historyMaxValueFilter')) : null
  };
}

function quoteMatchesHistoryFilters(quote, filters) {
  if (filters.seller && quote.seller !== filters.seller) return false;
  if (filters.status && quoteStatusOf(quote) !== filters.status) return false;
  if (filters.number && !String(quote.number || '').toUpperCase().includes(filters.number)) return false;
  if (filters.client) {
    const haystack = normalize(`${quote.client?.name || ''} ${quote.client?.document || ''} ${quote.client?.code || ''}`);
    if (!haystack.includes(filters.client)) return false;
  }
  if (filters.product) {
    const haystack = normalize((quote.items || []).map(item => `${item.code || ''} ${item.description || ''}`).join(' '));
    if (!haystack.includes(filters.product)) return false;
  }
  const total = quoteTotals(quote).total;
  if (filters.minValue !== null && total < filters.minValue) return false;
  if (filters.maxValue !== null && total > filters.maxValue) return false;
  const date = new Date(quoteStamp(quote));
  if (Number.isNaN(date.getTime())) return !(filters.startDate || filters.endDate || filters.startTime || filters.endTime);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
  const dateKey = local.slice(0, 10);
  const timeKey = local.slice(11, 16);
  if (filters.startDate && dateKey < filters.startDate) return false;
  if (filters.endDate && dateKey > filters.endDate) return false;
  if (filters.startTime && timeKey < filters.startTime) return false;
  if (filters.endTime && timeKey > filters.endTime) return false;
  return true;
}

function populateHistorySellerFilter(history) {
  const select = $('historySellerFilter');
  if (!select) return;
  const selected = select.value;
  const sellers = [...new Set(history.map(item => item.seller).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  select.innerHTML = '<option value="">Todos</option>' + sellers.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  if (sellers.includes(selected)) select.value = selected;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportQuoteCsv(id) {
  const quote = getHistory().find(item => item.id === id);
  if (!quote) return;
  const totals = quoteTotals(quote);
  const statusText = { sale: 'Venda', delivery: 'Entrega', quote: 'Orçamento' }[quoteStatusOf(quote)];
  const rows = [
    ['Registro', 'Situação', 'Data', 'Loja', 'Vendedor', 'Cliente', 'CPF/CNPJ', 'Telefone', 'Código', 'Descrição', 'Quantidade', 'Valor unitário', 'Total do item'],
    ...(quote.items || []).map(item => [
      quote.number, statusText, localDateTime(quoteStamp(quote)), quote.store || '', quote.seller || '',
      quote.client?.name || '', quote.client?.document || '', quote.client?.phone || '',
      item.code || '', item.description || '',
      numberBR.format(Number(item.qty) || 0),
      numberBR.format(Number(item.unitPrice) || 0),
      numberBR.format((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))
    ]),
    [],
    ['', '', '', '', '', '', '', '', '', 'Subtotal', '', '', numberBR.format(totals.subtotal)],
    ['', '', '', '', '', '', '', '', '', `Desconto (${numberBR.format(totals.discountPct)}%)`, '', '', `-${numberBR.format(totals.discountValue)}`],
    ['', '', '', '', '', '', '', '', '', 'Frete', '', '', numberBR.format(totals.freight)],
    ['', '', '', '', '', '', '', '', '', 'TOTAL', '', '', numberBR.format(totals.total)]
  ];
  const blob = new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `Orcamento_SEG_${quote.number}.csv`);
  showToast(`CSV do registro ${quote.number} gerado`);
}

function renderHistory() {
  const list = $('historyList');
  const history = getHistory();
  populateHistorySellerFilter(history);
  if (!history.length) {
    list.className = 'history-list empty-state';
    list.textContent = 'Nenhum orçamento salvo.';
    if ($('historyFilterSummary')) $('historyFilterSummary').textContent = 'Nenhum registro salvo ainda.';
    return;
  }
  const filters = historyFilterValues();
  const filtered = history.filter(quote => quoteMatchesHistoryFilters(quote, filters));
  if ($('historyFilterSummary')) {
    $('historyFilterSummary').textContent = filtered.length === history.length
      ? `${history.length} ${history.length === 1 ? 'registro' : 'registros'} no histórico.`
      : `${filtered.length} de ${history.length} registros correspondem aos filtros.`;
  }
  if (!filtered.length) {
    list.className = 'history-list empty-state';
    list.textContent = 'Nenhum registro encontrado para os filtros escolhidos.';
    return;
  }
  list.className = 'history-list';
  list.innerHTML = filtered.map(q => {
    const totals = quoteTotals(q);
    return `<article class="history-item">
      <div class="history-main">
        <div>
          <div class="history-number">REGISTRO Nº ${escapeHtml(q.number)} ${q.status === 'sale' ? '<span class="delivery-history-tag sale">VENDA</span>' : q.status === 'delivery' ? '<span class="delivery-history-tag">ENTREGA</span>' : '<span class="delivery-history-tag quote">ORÇAMENTO</span>'}</div>
          <div class="history-client">${escapeHtml(q.client?.name || 'Cliente não informado')}</div>
          <div class="history-meta">${escapeHtml(localDateTime(q.updatedAt || q.createdAt))} · ${q.items?.length || 0} itens · ${escapeHtml(q.store || '')} · ${escapeHtml(q.seller || '')}</div>
        </div>
        <div class="history-total">${money.format(totals.total)}</div>
      </div>
      <div class="history-actions">
        <button type="button" data-open-id="${escapeHtml(q.id)}">Abrir</button>
        <button type="button" data-print-id="${escapeHtml(q.id)}">PDF</button>
        <button type="button" data-csv-id="${escapeHtml(q.id)}">CSV</button>
        <button type="button" class="reuse" data-reuse-id="${escapeHtml(q.id)}">Reutilizar</button>
        <button type="button" data-model-id="${escapeHtml(q.id)}">Criar modelo</button>
      </div>
    </article>`;
  }).join('');
  list.querySelectorAll('[data-open-id]').forEach(b => b.addEventListener('click', () => loadQuote(b.dataset.openId)));
  list.querySelectorAll('[data-reuse-id]').forEach(b => b.addEventListener('click', () => reuseQuote(b.dataset.reuseId)));
  list.querySelectorAll('[data-model-id]').forEach(b => b.addEventListener('click', () => window.openQuoteTemplatesFromHistory?.(b.dataset.modelId)));
  list.querySelectorAll('[data-csv-id]').forEach(b => b.addEventListener('click', () => exportQuoteCsv(b.dataset.csvId)));
  list.querySelectorAll('[data-print-id]').forEach(b => b.addEventListener('click', () => {
    const q = getHistory().find(item => item.id === b.dataset.printId);
    if (q) printQuote(q);
  }));
}

const HISTORY_FILTER_IDS = ['historySellerFilter', 'historyStatusFilter', 'historyClientFilter', 'historyNumberFilter', 'historyProductFilter', 'historyStartDateFilter', 'historyEndDateFilter', 'historyStartTimeFilter', 'historyEndTimeFilter', 'historyMinValueFilter', 'historyMaxValueFilter'];

function bindHistoryFilters() {
  HISTORY_FILTER_IDS.forEach(id => $(id)?.addEventListener('input', renderHistory));
  $('clearHistoryFiltersBtn')?.addEventListener('click', () => {
    HISTORY_FILTER_IDS.forEach(id => { const el = $(id); if (el) el.value = ''; });
    renderHistory();
  });
}

function validityDate(quote) {
  const d = new Date(quote.createdAt || Date.now());
  d.setDate(d.getDate() + (Number(quote.validity) || 1));
  return d.toLocaleDateString('pt-BR');
}

function quotePrintHtml(quote) {
  const totals = quoteTotals(quote);
  const settings = getSettings();
  const logoSetting = getLogoSource(settings);
  const logoSrc = logoSetting.startsWith('data:') ? logoSetting : new URL(logoSetting, location.href).href;
  const authorization = quote.discountAuthorizedBy || {
    seller: quote.seller,
    role: quote.sellerRole || discountPolicy(quote).role,
    recordedAt: quote.updatedAt || quote.createdAt
  };
  const rows = quote.items.map((item, index) => `<tr>
    <td class="center">${index + 1}</td>
    <td><span class="item-code">${escapeHtml(item.code)}</span><strong>${escapeHtml(item.description)}</strong>${warrantySealsText(item) ? `<small class="item-seals"><b>Selos de garantia:</b> ${escapeHtml(warrantySealsText(item))}</small>` : ''}</td>
    <td class="right">${numberBR.format(item.qty)}</td>
    <td class="right">${money.format(item.unitPrice)}</td>
    <td class="right total-cell">${money.format(item.qty * item.unitPrice)}</td>
  </tr>`).join('');
  const phones = escapeHtml(settings.phones).replace(/\n/g, '<br>');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Orçamento ${escapeHtml(quote.number)}</title>
  <style>
    @page { size: A4; margin: 9mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #17231d; font-size: 10pt; background: #fff; }
    .document { border-top: 7px solid #006a3b; box-shadow: inset 0 2px 0 #1b7f9e; }
    .header { display:flex; justify-content:space-between; gap:28px; align-items:center; padding:18px 18px 15px; border-bottom:1px solid #dce7e1; }
    .logo-wrap { width: 310px; height: 104px; display:flex; align-items:center; }
    .logo { max-width:100%; max-height:100px; object-fit:contain; border-radius:6px; }
    .title { text-align:right; }
    .title h1 { margin:0; color:#006a3b; font-size:26pt; letter-spacing:.08em; }
    .quote-number { display:inline-block; margin-top:8px; padding:7px 12px; border-radius:999px; background:#e7f3ed; color:#006a3b; font-weight:700; }
    .meta { color:#64736b; margin-top:7px; font-size:9pt; }
    .info-card { margin:16px 18px; padding:14px 16px; border:1px solid #d6e5dc; border-radius:12px; background:#f4faf7; display:grid; grid-template-columns:1fr 1fr; gap:9px 28px; }
    .info-item { display:grid; grid-template-columns:94px 1fr; gap:7px; min-width:0; }
    .info-item span:first-child { color:#637169; font-size:8.5pt; text-transform:uppercase; font-weight:700; }
    .info-item strong { overflow-wrap:anywhere; }
    table { width:calc(100% - 36px); margin:0 18px; border-collapse:separate; border-spacing:0; overflow:hidden; border:1px solid #dce5e0; border-radius:11px; }
    thead th { padding:9px 8px; background:#006a3b; color:#fff; text-align:left; font-size:8.5pt; letter-spacing:.03em; }
    tbody td { padding:9px 8px; border-bottom:1px solid #e4ebe7; vertical-align:top; }
    tbody tr:last-child td { border-bottom:0; }
    tbody tr:nth-child(even) { background:#f8faf9; }
    .center { text-align:center; } .right { text-align:right; white-space:nowrap; }
    .item-code { display:block; color:#006a3b; font-size:8pt; font-weight:700; margin-bottom:3px; }
    .item-seals { display:block; margin-top:5px; color:#4f5f56; line-height:1.35; }
    .total-cell { font-weight:700; }
    .bottom { display:grid; grid-template-columns:1fr 290px; gap:18px; margin:16px 18px; align-items:start; }
    .notes { min-height:105px; padding:13px; border:1px solid #dce5e0; border-radius:11px; color:#445149; white-space:pre-wrap; }
    .notes strong { display:block; color:#006a3b; margin-bottom:7px; }
    .totals { padding:14px; border-radius:12px; background:#f1f6f3; }
    .totals div { display:flex; justify-content:space-between; gap:14px; padding:6px 0; }
    .totals .grand { margin-top:7px; padding:12px; border-radius:9px; background:#006a3b; color:#fff; font-size:12pt; font-weight:800; }
    .footer { margin-top:18px; padding:14px 18px; border-top:1px solid #dce7e1; background:#f7faf8; display:grid; grid-template-columns:1fr 1.35fr; gap:20px; color:#536159; font-size:8.5pt; line-height:1.45; }
    .footer strong { color:#006a3b; font-size:10pt; }
    .legal { padding:8px 18px 0; color:#6a756f; font-size:8pt; }
    @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
  </style></head><body>
  <div class="document">
    <div class="header">
      <div class="logo-wrap"><img class="logo" src="${logoSrc}" alt="SEG"></div>
      <div class="title"><h1>ORÇAMENTO</h1><div class="quote-number">Nº ${escapeHtml(quote.number)}</div><div class="meta">Aberto em ${escapeHtml(localDateTime(quote.createdAt))}</div></div>
    </div>
    <div class="info-card">
      <div class="info-item"><span>Cliente</span><strong>${escapeHtml(quote.client.name)}</strong></div>
      <div class="info-item"><span>Telefone</span><strong>${escapeHtml(quote.client.phone || '—')}</strong></div>
      <div class="info-item"><span>CPF / CNPJ</span><strong>${escapeHtml(quote.client.document || '—')}</strong></div>
      <div class="info-item"><span>Cidade</span><strong>${escapeHtml(`${quote.client.city || ''}${quote.client.state ? ' / ' + quote.client.state : ''}`)}</strong></div>
      <div class="info-item"><span>Endereço</span><strong>${escapeHtml(quote.client.address || '—')}</strong></div>
      <div class="info-item"><span>Loja</span><strong>${escapeHtml(quote.store)}</strong></div>
      <div class="info-item"><span>Vendedor</span><strong>${escapeHtml(quote.seller)} — ${escapeHtml(roleLabel(authorization.role))}</strong></div>
      <div class="info-item"><span>Pagamento</span><strong>${escapeHtml(quote.payment)}</strong></div>
      <div class="info-item"><span>Validade</span><strong>${escapeHtml(validityDate(quote))}</strong></div>
      <div class="info-item"><span>Desconto</span><strong>${numberBR.format(totals.discountPct)}%</strong></div>
    </div>
    <table>
      <colgroup><col style="width:6%"><col><col style="width:9%"><col style="width:15%"><col style="width:15%"></colgroup>
      <thead><tr><th>#</th><th>Produto</th><th class="right">Qtd.</th><th class="right">Valor unitário</th><th class="right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="bottom">
      <div class="notes"><strong>Observações</strong>${escapeHtml(quote.notes || 'Sem observações adicionais.')}</div>
      <div class="totals">
        <div><span>Subtotal</span><strong>${money.format(totals.subtotal)}</strong></div>
        <div><span>Desconto</span><strong>-${money.format(totals.discountValue)}</strong></div>
        <div><span>Frete</span><strong>${money.format(totals.freight)}</strong></div>
        <div class="grand"><span>Total</span><strong>${money.format(totals.total)}</strong></div>
      </div>
    </div>
    <div class="footer"><div><strong>${escapeHtml(settings.site)}</strong><br>WhatsApp de atendimento e vendas: (21) 3081-8100</div><div>${phones}</div></div>
    <div class="legal">Preços válidos até ${escapeHtml(validityDate(quote))} e sujeitos a alteração. Documento gerado pelo SEG Vendas.</div>
  </div>
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),450));<\/script>
  </body></html>`;
}

function printQuote(quote = currentQuote) {
  let prepared = quote;
  if (quote === currentQuote) {
    prepared = prepareQuoteForSend();
    if (!prepared) return;
  }
  const popup = window.open('', '_blank');
  if (!popup) { showToast('Permita pop-ups para gerar o PDF'); return; }
  popup.document.open();
  popup.document.write(quotePrintHtml(structuredClone(prepared)));
  popup.document.close();
}


function salesContactsForStore(store) {
  return STORE_SALES_CONTACTS[store] || [{ name: 'Atendimento central SEG', phone: CENTRAL_WHATSAPP }];
}

function populateSalesSellerSelect() {
  const store = $('salesStoreSelect').value;
  const contacts = salesContactsForStore(store);
  $('salesSellerSelect').innerHTML = contacts.map((contact, index) => `<option value="${index}">${escapeHtml(contact.name)}</option>`).join('');
}

function openSalesContact(index) {
  const product = productIndex.find(item => item.i === index);
  if (!product) return;
  pendingSalesProduct = product;
  $('salesProductSummary').innerHTML = `<span>CÓD. ${escapeHtml(product.code)}</span><strong>${escapeHtml(product.desc)}</strong><b>${money.format(product.price)}</b>`;
  $('salesClientName').value = currentQuote.client.name || localStorage.getItem('seg_sales_client_name') || '';
  $('salesQuantity').value = 1;
  $('salesStoreSelect').innerHTML = STORES.map(store => `<option>${escapeHtml(store)}</option>`).join('');
  $('salesStoreSelect').value = currentQuote.store || STORES[0];
  populateSalesSellerSelect();
  $('salesContactModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function openModal(id) {
  $(id)?.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal(id) {
  $(id)?.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function openSellerWhatsapp() {
  if (!pendingSalesProduct) return;
  const store = $('salesStoreSelect').value;
  const contacts = salesContactsForStore(store);
  const contact = contacts[Number($('salesSellerSelect').value)] || contacts[0];
  const clientName = $('salesClientName').value.trim() || 'Não informado';
  const quantity = Math.max(1, Number($('salesQuantity').value) || 1);
  localStorage.setItem('seg_sales_client_name', clientName === 'Não informado' ? '' : clientName);
  const text = [
    'Olá! Vim pelo aplicativo SEG Vendas e gostaria de falar com um vendedor.',
    '',
    `Cliente: ${clientName}`,
    `Loja escolhida: ${store}`,
    `Vendedor / atendimento: ${contact.name}`,
    `Código: ${pendingSalesProduct.code}`,
    `Produto: ${pendingSalesProduct.desc}`,
    `Quantidade desejada: ${numberBR.format(quantity)}`,
    `Preço exibido no aplicativo: ${money.format(pendingSalesProduct.price)}`,
    '',
    'Gostaria de receber mais informações e um orçamento.'
  ].join('\n');
  closeModal('salesContactModal');
  window.open(`https://wa.me/${contact.phone}?text=${encodeURIComponent(text)}`, '_blank');
}

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function roundedRect(ctx, x, y, width, height, radius, fill, stroke = '') {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function canvasLines(ctx, text, maxWidth) {
  const paragraphs = String(text || '').split(/\n/);
  const lines = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawTextLines(ctx, lines, x, y, lineHeight, maxLines = Infinity) {
  lines.slice(0, maxLines).forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

async function renderQuoteCanvas(quote = currentQuote) {
  const totals = quoteTotals(quote);
  const settings = getSettings();
  const width = 1240;
  const pad = 68;
  const descWidth = 520;
  const rowFont = '26px Arial';
  const sizing = document.createElement('canvas').getContext('2d');
  sizing.font = rowFont;
  const itemRows = quote.items.map(item => {
    const sealText = warrantySealsText(item);
    const lines = canvasLines(sizing, `${item.description}${sealText ? ` · Selos: ${sealText}` : ''}`, descWidth);
    return { item, lines, height: Math.max(78, 34 * lines.length + 30) };
  });
  sizing.font = '25px Arial';
  const noteLines = canvasLines(sizing, quote.notes || 'Sem observações adicionais.', 590);
  const headerHeight = 205;
  const infoHeight = 315;
  const tableHeaderHeight = 65;
  const rowsHeight = itemRows.reduce((sum, row) => sum + row.height, 0);
  const summaryHeight = Math.max(320, 120 + noteLines.length * 32);
  const footerHeight = 220;
  const height = headerHeight + infoHeight + tableHeaderHeight + rowsHeight + summaryHeight + footerHeight + 110;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#006a3b';
  ctx.fillRect(0, 0, width, 21);
  ctx.fillStyle = '#1b7f9e';
  ctx.fillRect(0, 21, width, 5);

  let y = 58;
  try {
    const logo = await loadCanvasImage(getLogoSource(settings));
    const maxW = 390, maxH = 110;
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    ctx.drawImage(logo, pad, y, logo.width * ratio, logo.height * ratio);
  } catch {}
  ctx.fillStyle = '#5e6b65';
  ctx.font = '700 16px Arial';
  ctx.fillText('SEG INTERNATIONAL - SEGURANÇA ELETRÔNICA', pad, y + 137);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#006a3b';
  ctx.font = '800 54px Arial';
  ctx.fillText('ORÇAMENTO', width - pad, y + 42);
  roundedRect(ctx, width - pad - 215, y + 62, 215, 52, 26, '#e6f2ec');
  ctx.fillStyle = '#006a3b';
  ctx.font = '700 25px Arial';
  ctx.fillText(`Nº ${quote.number}`, width - pad - 18, y + 96);
  ctx.fillStyle = '#68766f';
  ctx.font = '22px Arial';
  ctx.fillText(localDateTime(quote.createdAt), width - pad, y + 144);
  ctx.textAlign = 'left';
  y = headerHeight;

  roundedRect(ctx, pad, y, width - pad * 2, infoHeight - 35, 24, '#f3f9f6', '#d4e5dc');
  const info = [
    ['CLIENTE', quote.client.name || '—'], ['TELEFONE', quote.client.phone || '—'],
    ['CPF / CNPJ', quote.client.document || '—'], ['CIDADE', `${quote.client.city || '—'}${quote.client.state ? ' / ' + quote.client.state : ''}`],
    ['ENDEREÇO', quote.client.address || '—'], ['LOJA', quote.store || '—'],
    ['VENDEDOR', `${quote.seller || '—'} — ${roleLabel(quote.sellerRole || discountPolicy(quote).role)}`], ['PAGAMENTO', quote.payment || '—'],
    ['VALIDADE', validityDate(quote)], ['DESCONTO', `${numberBR.format(totals.discountPct)}%`]
  ];
  const colW = (width - pad * 2 - 70) / 2;
  info.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = pad + 28 + col * (colW + 30);
    const iy = y + 42 + row * 51;
    ctx.fillStyle = '#65746c'; ctx.font = '700 17px Arial'; ctx.fillText(label, x, iy);
    ctx.fillStyle = '#19251f'; ctx.font = '700 22px Arial';
    const lines = canvasLines(ctx, value, colW - 115);
    ctx.fillText(lines[0] || '—', x + 115, iy);
  });
  y += infoHeight;

  const colX = { seq: pad, product: pad + 75, qty: 790, unit: 915, total: 1080 };
  roundedRect(ctx, pad, y, width - pad * 2, tableHeaderHeight, 14, '#006a3b');
  ctx.fillStyle = '#fff'; ctx.font = '700 20px Arial';
  ctx.fillText('#', colX.seq + 24, y + 41);
  ctx.fillText('PRODUTO', colX.product, y + 41);
  ctx.textAlign = 'right';
  ctx.fillText('QTD.', colX.qty + 74, y + 41);
  ctx.fillText('UNITÁRIO', colX.unit + 120, y + 41);
  ctx.fillText('TOTAL', width - pad - 18, y + 41);
  ctx.textAlign = 'left';
  y += tableHeaderHeight;

  itemRows.forEach((row, index) => {
    ctx.fillStyle = index % 2 ? '#f8faf9' : '#ffffff';
    ctx.fillRect(pad, y, width - pad * 2, row.height);
    ctx.strokeStyle = '#e1e9e5'; ctx.beginPath(); ctx.moveTo(pad, y + row.height); ctx.lineTo(width - pad, y + row.height); ctx.stroke();
    ctx.fillStyle = '#68766f'; ctx.font = '22px Arial'; ctx.fillText(String(index + 1), colX.seq + 22, y + 45);
    ctx.fillStyle = '#006a3b'; ctx.font = '700 18px Arial'; ctx.fillText(`CÓD. ${row.item.code}`, colX.product, y + 29);
    ctx.fillStyle = '#1b2821'; ctx.font = rowFont; drawTextLines(ctx, row.lines, colX.product, y + 61, 34);
    ctx.textAlign = 'right'; ctx.font = '23px Arial'; ctx.fillText(numberBR.format(row.item.qty), colX.qty + 74, y + 48);
    ctx.fillText(money.format(row.item.unitPrice), colX.unit + 120, y + 48);
    ctx.font = '700 23px Arial'; ctx.fillText(money.format(row.item.qty * row.item.unitPrice), width - pad - 18, y + 48);
    ctx.textAlign = 'left';
    y += row.height;
  });

  y += 35;
  const notesW = 650;
  const totalsX = pad + notesW + 34;
  roundedRect(ctx, pad, y, notesW, summaryHeight - 55, 20, '#ffffff', '#dce7e1');
  ctx.fillStyle = '#006a3b'; ctx.font = '700 24px Arial'; ctx.fillText('OBSERVAÇÕES', pad + 24, y + 42);
  ctx.fillStyle = '#48564e'; ctx.font = '24px Arial'; drawTextLines(ctx, noteLines, pad + 24, y + 82, 32);
  roundedRect(ctx, totalsX, y, width - pad - totalsX, summaryHeight - 55, 20, '#f0f6f3');
  const totalRows = [
    ['Subtotal', money.format(totals.subtotal)],
    ['Desconto', `- ${money.format(totals.discountValue)}`],
    ['Frete', money.format(totals.freight)]
  ];
  totalRows.forEach(([label, value], index) => {
    const ty = y + 45 + index * 48;
    ctx.fillStyle = '#5e6d65'; ctx.font = '23px Arial'; ctx.fillText(label, totalsX + 24, ty);
    ctx.fillStyle = '#17231d'; ctx.font = '700 23px Arial'; ctx.textAlign = 'right'; ctx.fillText(value, width - pad - 24, ty); ctx.textAlign = 'left';
  });
  roundedRect(ctx, totalsX + 18, y + summaryHeight - 105, width - pad - totalsX - 36, 75, 16, '#006a3b');
  ctx.fillStyle = '#fff'; ctx.font = '700 25px Arial'; ctx.fillText('TOTAL', totalsX + 40, y + summaryHeight - 57);
  ctx.textAlign = 'right'; ctx.font = '800 31px Arial'; ctx.fillText(money.format(totals.total), width - pad - 40, y + summaryHeight - 57); ctx.textAlign = 'left';
  y += summaryHeight;

  ctx.fillStyle = '#f6f9f7'; ctx.fillRect(0, y, width, footerHeight);
  ctx.fillStyle = '#006a3b'; ctx.font = '700 27px Arial'; ctx.fillText(settings.site, pad, y + 52);
  ctx.fillStyle = '#34423a'; ctx.font = '23px Arial'; ctx.fillText('WhatsApp de atendimento e vendas: (21) 3081-8100', pad, y + 91);
  ctx.fillStyle = '#65736b'; ctx.font = '20px Arial';
  const footerLines = canvasLines(ctx, settings.phones, width - pad * 2);
  drawTextLines(ctx, footerLines, pad, y + 128, 27, 4);
  ctx.fillStyle = '#006a3b'; ctx.fillRect(0, height - 24, width, 24);
  return canvas;
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível gerar o arquivo')), type, quality));
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach(part => { output.set(part, offset); offset += part.length; });
  return output;
}

async function createPdfBlobFromCanvas(sourceCanvas) {
  const encoder = new TextEncoder();
  const pageWidthPx = sourceCanvas.width;
  const pageHeightPx = Math.round(pageWidthPx * 841.89 / 595.28);
  const pageImages = [];
  for (let offsetY = 0; offsetY < sourceCanvas.height; offsetY += pageHeightPx) {
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = pageWidthPx;
    pageCanvas.height = pageHeightPx;
    const pageCtx = pageCanvas.getContext('2d');
    pageCtx.fillStyle = '#fff'; pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    const sliceHeight = Math.min(pageHeightPx, sourceCanvas.height - offsetY);
    pageCtx.drawImage(sourceCanvas, 0, offsetY, pageWidthPx, sliceHeight, 0, 0, pageWidthPx, sliceHeight);
    const jpegBlob = await canvasBlob(pageCanvas, 'image/jpeg', .93);
    pageImages.push(new Uint8Array(await jpegBlob.arrayBuffer()));
  }
  const parts = [];
  const offsets = [];
  let byteOffset = 0;
  const pushAscii = text => { const bytes = encoder.encode(text); parts.push(bytes); byteOffset += bytes.length; };
  const pushBytes = bytes => { parts.push(bytes); byteOffset += bytes.length; };
  const pageIds = pageImages.map((_, i) => 3 + i * 3);
  const objectCount = 2 + pageImages.length * 3;
  pushAscii('%PDF-1.4\n');
  offsets[1] = byteOffset; pushAscii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offsets[2] = byteOffset; pushAscii(`2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>\nendobj\n`);
  pageImages.forEach((jpeg, i) => {
    const pageId = 3 + i * 3, imageId = pageId + 1, contentId = pageId + 2;
    offsets[pageId] = byteOffset;
    pushAscii(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    offsets[imageId] = byteOffset;
    pushAscii(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pageWidthPx} /Height ${pageHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    pushBytes(jpeg); pushAscii('\nendstream\nendobj\n');
    const content = 'q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
    offsets[contentId] = byteOffset;
    pushAscii(`${contentId} 0 obj\n<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);
  });
  const xrefOffset = byteOffset;
  pushAscii(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id++) pushAscii(`${String(offsets[id] || 0).padStart(10, '0')} 00000 n \n`);
  pushAscii(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob([concatBytes(parts)], { type: 'application/pdf' });
}

async function shareGeneratedFile(file, quote, fallbackMessage) {
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title: `Orçamento SEG Nº ${quote.number}`, text: `Orçamento SEG Nº ${quote.number} — ${quote.client.name}`, files: [file] });
      return;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return;
  }
  downloadBlob(file, file.name);
  window.open(`https://wa.me/?text=${encodeURIComponent(fallbackMessage)}`, '_blank');
  showToast('Arquivo baixado. Anexe-o na conversa do WhatsApp.');
}

async function shareQuoteAsPhoto() {
  const quote = prepareQuoteForSend();
  if (!quote) return;
  if (currentQuote.client.name.trim()) saveQuote(true);
  showToast('Preparando imagem do orçamento…');
  try {
    const canvas = await renderQuoteCanvas(quote);
    const blob = await canvasBlob(canvas, 'image/jpeg', .94);
    const file = new File([blob], `Orcamento_SEG_${quote.number}.jpg`, { type: 'image/jpeg' });
    await shareGeneratedFile(file, quote, `Orçamento SEG Nº ${quote.number}. A imagem foi baixada; anexe-a nesta conversa.`);
  } catch (error) {
    console.error(error); showToast('Não foi possível gerar a foto do orçamento.');
  }
}

async function shareQuoteAsPdf() {
  const quote = prepareQuoteForSend();
  if (!quote) return;
  if (currentQuote.client.name.trim()) saveQuote(true);
  showToast('Preparando PDF do orçamento…');
  try {
    const canvas = await renderQuoteCanvas(quote);
    const blob = await createPdfBlobFromCanvas(canvas);
    const file = new File([blob], `Orcamento_SEG_${quote.number}.pdf`, { type: 'application/pdf' });
    await shareGeneratedFile(file, quote, `Orçamento SEG Nº ${quote.number}. O PDF foi baixado; anexe-o nesta conversa.`);
  } catch (error) {
    console.error(error); showToast('Não foi possível gerar o PDF.');
  }
}

function whatsappText(quote) {
  const totals = quoteTotals(quote);
  const lines = [
    `*ORÇAMENTO SEG Nº ${quote.number}*`,
    `Cliente: ${quote.client.name}`,
    `Loja: ${quote.store}`,
    `Vendedor: ${quote.seller} (${roleLabel(quote.sellerRole || discountPolicy(quote).role)})`,
    isPromotionQuote(quote) ? 'Promoção Dia do Instalador — válida somente em 31/07/2026' : '',
    '',
    ...quote.items.map((item, i) => `${i + 1}. ${item.description}\n   ${numberBR.format(item.qty)} x ${money.format(item.unitPrice)} = ${money.format(item.qty * item.unitPrice)}${warrantySealsText(item) ? `\n   Selos: ${warrantySealsText(item)}` : ''}`),
    '',
    `Subtotal: ${money.format(totals.subtotal)}`,
    totals.discountValue ? `Desconto: -${money.format(totals.discountValue)}` : '',
    totals.freight ? `Frete: ${money.format(totals.freight)}` : '',
    `*TOTAL: ${money.format(totals.total)}*`,
    `Condição: ${quote.payment}`,
    `Validade: ${validityDate(quote)}`,
    quote.notes ? `Observações: ${quote.notes}` : '',
    '',
    getSettings().site
  ].filter(Boolean);
  return lines.join('\n');
}

function shareWhatsapp() {
  const quote = prepareQuoteForSend();
  if (!quote) return;
  if (currentQuote.client.name.trim()) saveQuote(true);
  const url = `https://wa.me/?text=${encodeURIComponent(whatsappText(quote))}`;
  window.open(url, '_blank');
}

function applySendNameToQuote(nameOverride) {
  if (!nameOverride) return;
  currentQuote.client.name = nameOverride;
  $('clientName').value = nameOverride;
  refreshQuoteGuideState();
}

function normalizeWhatsappNumber(value) {
  return String(value || '').replace(/\D/g, '');
}

function openSendQuoteModal() {
  if (!prepareQuoteForSend()) return;
  $('sendQuoteClientName').value = currentQuote.client?.name || '';
  $('sendQuoteWhatsapp').value = currentQuote.client?.phone || '';
  $('sendQuoteEmail').value = '';
  $('sendQuoteFormat').value = 'text';
  openModal('sendQuoteModal');
}

async function generateQuoteFile(format, quote) {
  const canvas = await renderQuoteCanvas(quote);
  if (format === 'photo') {
    const blob = await canvasBlob(canvas, 'image/jpeg', .94);
    return new File([blob], `Orcamento_SEG_${quote.number}.jpg`, { type: 'image/jpeg' });
  }
  const blob = await createPdfBlobFromCanvas(canvas);
  return new File([blob], `Orcamento_SEG_${quote.number}.pdf`, { type: 'application/pdf' });
}

async function sendQuoteViaWhatsapp() {
  const nameOverride = $('sendQuoteClientName').value.trim();
  applySendNameToQuote(nameOverride);
  const quote = prepareQuoteForSend();
  if (!quote) return;
  const phone = normalizeWhatsappNumber($('sendQuoteWhatsapp').value);
  const format = $('sendQuoteFormat').value;
  closeModal('sendQuoteModal');
  if (quote.client.name !== 'Cliente não informado') saveQuote(true);
  showToast('Preparando envio pelo WhatsApp…');
  if (format === 'text') {
    const url = `https://wa.me/${phone ? phone : ''}?text=${encodeURIComponent(whatsappText(quote))}`;
    window.open(url, '_blank');
    return;
  }
  try {
    const file = await generateQuoteFile(format, quote);
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: `Orçamento SEG Nº ${quote.number}`, text: `Orçamento SEG Nº ${quote.number} — ${quote.client.name}`, files: [file] });
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
    downloadBlob(file, file.name);
    const url = `https://wa.me/${phone ? phone : ''}?text=${encodeURIComponent(`Orçamento SEG Nº ${quote.number} — ${quote.client.name}.\nO arquivo (${file.name}) foi baixado. Anexe-o nesta conversa.`)}`;
    window.open(url, '_blank');
    showToast('Arquivo baixado. Anexe-o na conversa do WhatsApp.');
  } catch (error) {
    console.error(error); showToast('Não foi possível gerar o arquivo.');
  }
}

async function sendQuoteViaEmail() {
  const nameOverride = $('sendQuoteClientName').value.trim();
  applySendNameToQuote(nameOverride);
  const quote = prepareQuoteForSend();
  if (!quote) return;
  const email = $('sendQuoteEmail').value.trim();
  const format = $('sendQuoteFormat').value;
  closeModal('sendQuoteModal');
  if (quote.client.name !== 'Cliente não informado') saveQuote(true);
  showToast('Preparando envio por e-mail…');
  const subject = `Orçamento SEG Nº ${quote.number}`;
  const body = whatsappText(quote);
  if (format === 'text') {
    window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    return;
  }
  try {
    const file = await generateQuoteFile(format, quote);
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: subject, text: `Orçamento SEG Nº ${quote.number} — ${quote.client.name}`, files: [file] });
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
    downloadBlob(file, file.name);
    const fallbackBody = `Orçamento SEG Nº ${quote.number} — ${quote.client.name}.\n\nO arquivo ${file.name} foi baixado. Anexe-o a este e-mail.\n\n${body}`;
    window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fallbackBody)}`, '_blank');
    showToast('Arquivo baixado. Anexe-o ao e-mail.');
  } catch (error) {
    console.error(error); showToast('Não foi possível gerar o arquivo.');
  }
}

function exportHistory() {
  const history = getHistory();
  if (!history.length) { showToast('Não há orçamentos para exportar'); return; }
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `seg-orcamentos-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportFilteredHistoryCsv() {
  const filters = historyFilterValues();
  const filtered = getHistory().filter(quote => quoteMatchesHistoryFilters(quote, filters));
  if (!filtered.length) { showToast('Não há registros para exportar com os filtros atuais'); return; }
  const statusText = quote => ({ sale: 'Venda', delivery: 'Entrega', quote: 'Orçamento' }[quoteStatusOf(quote)]);
  const rows = [
    ['Registro', 'Situação', 'Data', 'Loja', 'Vendedor', 'Cliente', 'CPF/CNPJ', 'Telefone', 'Itens', 'Subtotal', 'Desconto', 'Frete', 'Total'],
    ...filtered.map(quote => {
      const totals = quoteTotals(quote);
      return [
        quote.number, statusText(quote), localDateTime(quoteStamp(quote)), quote.store || '', quote.seller || '',
        quote.client?.name || '', quote.client?.document || '', quote.client?.phone || '',
        quote.items?.length || 0,
        numberBR.format(totals.subtotal), numberBR.format(totals.discountValue),
        numberBR.format(totals.freight), numberBR.format(totals.total)
      ];
    })
  ];
  const blob = new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `historico-seg-${new Date().toISOString().slice(0,10)}.csv`);
  showToast(`${filtered.length} ${filtered.length === 1 ? 'registro' : 'registros'} exportados em CSV`);
}



function getForumTopics() {
  try {
    const stored = JSON.parse(localStorage.getItem('seg_forum_topics') || 'null');
    if (Array.isArray(stored)) return stored;
  } catch {}
  const seed = structuredClone(FORUM_SEED_TOPICS);
  localStorage.setItem('seg_forum_topics', JSON.stringify(seed));
  return seed;
}

function setForumTopics(topics) {
  localStorage.setItem('seg_forum_topics', JSON.stringify(topics));
}

function allManuals() {
  return [...BUILT_IN_MANUALS, ...serverManuals];
}

function manualMatches(manual, query, category) {
  const haystack = normalize(`${manual.title} ${manual.code || ''} ${manual.category} ${manual.brand} ${manual.models} ${manual.description}`);
  const tokens = normalize(query).split(' ').filter(Boolean);
  const categoryOk = !category || manual.category === category;
  return categoryOk && (!tokens.length || tokens.every(token => haystack.includes(token)));
}

function manualDateLabel(value) {
  if (!value) return 'sem data';
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? 'sem data' : date.toLocaleDateString('pt-BR');
}

function manualApiHeaders(includeJson = false) {
  const headers = {
    'X-SEG-User': currentQuote.seller || '',
    'X-SEG-Role': isCurrentCoordinator() ? 'coordinator' : 'seller',
    'X-SEG-Store': currentQuote.store || ''
  };
  if (includeJson) headers['Content-Type'] = 'application/json';
  return headers;
}

async function loadServerManuals({ silent = false } = {}) {
  try {
    const response = await apiFetch('/api/manuals', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Falha ao carregar manuais');
    serverManuals = Array.isArray(data.manuals) ? data.manuals : [];
    if ($('manualResults')) renderManuals(false);
  } catch (error) {
    console.error(error);
    if (!silent) showToast('Biblioteca local de manuais indisponível');
  }
}

function manualCard(manual) {
  const approved = manual.approved ? '<span class="official-badge">Aprovado pela SEG</span>' : '';
  const visibility = manual.visibility === 'internal'
    ? '<span class="manual-visibility internal">Somente funcionários</span>'
    : '<span class="manual-visibility public">Público</span>';
  const code = manual.code ? `<strong>Código:</strong> ${escapeHtml(manual.code)} &nbsp;` : '';
  const actions = manual.source === 'local' && isCurrentCoordinator()
    ? `<div class="manual-admin-actions">
        <button class="text-btn edit-manual-btn" data-manual-id="${escapeHtml(manual.id)}" type="button">Editar</button>
        <button class="text-btn danger delete-manual-btn" data-manual-id="${escapeHtml(manual.id)}" type="button">Excluir</button>
      </div>`
    : '';
  return `<article class="manual-card">
    <div class="manual-card-top">
      <div class="manual-tags"><span class="manual-category">${escapeHtml(manual.category)}</span>${approved}${manual.source === 'local' ? visibility : ''}</div>
      <span class="manual-date">Atualizado em ${escapeHtml(manualDateLabel(manual.updatedAt))}</span>
    </div>
    <h3>${escapeHtml(manual.title)}</h3>
    <p>${escapeHtml(manual.description || 'Documento técnico cadastrado na biblioteca SEG.')}</p>
    <div class="manual-meta">${code}<strong>Marca:</strong> ${escapeHtml(manual.brand || '—')} &nbsp; <strong>Modelo:</strong> ${escapeHtml(manual.models || '—')}</div>
    <div class="manual-card-actions">
      <a class="btn primary manual-open-btn" href="${escapeHtml(manual.url)}" target="_blank" rel="noopener">Abrir documento</a>
      ${actions}
    </div>
  </article>`;
}

function productManualRequestCard(product) {
  return `<article class="manual-card missing-manual">
    <div><span class="manual-category">PRODUTO ENCONTRADO</span></div>
    <h3>${escapeHtml(product.code)} — ${escapeHtml(product.desc)}</h3>
    <p>Ainda não existe um PDF oficial vinculado a este produto nesta versão.</p>
    <button class="btn secondary request-manual-btn" data-manual-code="${escapeHtml(product.code)}" data-manual-desc="${escapeHtml(product.desc)}" type="button">Solicitar manual no fórum</button>
  </article>`;
}

function bindManualResultActions(results) {
  results.querySelectorAll('.request-manual-btn').forEach(button => button.addEventListener('click', () => {
    openManualRequest(button.dataset.manualDesc, button.dataset.manualCode);
  }));
  results.querySelectorAll('.edit-manual-btn').forEach(button => button.addEventListener('click', () => openManualManager(button.dataset.manualId)));
  results.querySelectorAll('.delete-manual-btn').forEach(button => button.addEventListener('click', () => deleteManual(button.dataset.manualId)));
}

function renderManuals(showAll = false) {
  const input = $('manualSearchInput');
  const clear = $('manualSearchClear');
  const results = $('manualResults');
  const query = input.value.trim();
  const category = $('manualCategoryFilter').value;
  clear.classList.toggle('hidden', !query);
  updateOfficialSourceHint();

  const matchedManuals = allManuals().filter(manual => manualMatches(manual, query, category));
  const normalizedQuery = normalize(query);
  const products = normalizedQuery.length >= 2 ? searchProducts(query, 8) : [];

  if (!showAll && normalizedQuery.length < 2 && !category) {
    results.className = 'manual-results empty-state';
    results.textContent = 'Digite ao menos 2 caracteres para procurar um manual ou produto.';
    renderSegHelpResults();
    return;
  }

  const cards = [];
  matchedManuals.forEach(manual => cards.push(manualCard(manual)));
  products.forEach(product => {
    const linked = matchedManuals.some(manual => {
      const manualText = normalize(`${manual.code || ''} ${manual.models} ${manual.description}`);
      return manualText.includes(normalize(product.code));
    });
    if (!linked) cards.push(productManualRequestCard(product));
  });

  if (!cards.length) {
    results.className = 'manual-results empty-state';
    results.innerHTML = 'Nenhum manual local ou produto encontrado. <button id="genericManualRequestBtn" class="text-btn" type="button">Publicar solicitação no fórum</button>';
    $('genericManualRequestBtn')?.addEventListener('click', () => openManualRequest(query, ''));
    renderSegHelpResults();
    return;
  }

  results.className = 'manual-results';
  results.innerHTML = cards.join('');
  bindManualResultActions(results);
  renderSegHelpResults();
}

function segHelpCard(item) {
  const date = item.updatedAt ? `<span>Atualizado em ${escapeHtml(manualDateLabel(item.updatedAt))}</span>` : '';
  const summary = item.summary || 'Abra o artigo para consultar a orientação completa da Central de Ajuda SEG.';
  return `<article class="official-result-card">
    <div class="official-result-head">
      <span class="official-badge">Conteúdo oficial SEG</span>
      ${date}
    </div>
    <h3>${escapeHtml(item.title || 'Artigo da Central de Ajuda')}</h3>
    <p>${escapeHtml(summary)}</p>
    <a class="btn primary" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Abrir artigo completo</a>
  </article>`;
}

function renderSegHelpResults() {
  const container = $('segHelpResults');
  if (!container) return;
  const currentQuery = currentSupportQuery();
  if (segHelpSearchState.loading) {
    container.className = 'official-results loading-state';
    container.innerHTML = '<div class="search-spinner"></div><strong>Pesquisando na Central de Ajuda SEG…</strong>';
    return;
  }
  if (segHelpSearchState.error) {
    container.className = 'official-results error-state';
    container.innerHTML = `<strong>Não foi possível trazer os resultados para dentro do aplicativo.</strong><span>${escapeHtml(segHelpSearchState.error)}</span><button id="openSegHelpFallbackBtn" class="btn secondary" type="button">Abrir pesquisa no site SEG Ajuda</button>`;
    $('openSegHelpFallbackBtn')?.addEventListener('click', () => openOfficialSource('seg'));
    return;
  }
  if (!segHelpSearchState.query || normalize(segHelpSearchState.query) !== normalize(currentQuery)) {
    container.className = 'official-results empty-state compact';
    container.textContent = 'Use o botão “Pesquisar no SEG Ajuda” para trazer artigos oficiais para esta tela.';
    return;
  }
  if (!segHelpSearchState.results.length) {
    container.className = 'official-results empty-state compact';
    container.innerHTML = `Nenhum artigo oficial foi encontrado para “${escapeHtml(segHelpSearchState.query)}”. <button id="openSegHelpNoResultBtn" class="text-btn" type="button">Abrir o site</button>`;
    $('openSegHelpNoResultBtn')?.addEventListener('click', () => openOfficialSource('seg'));
    return;
  }
  container.className = 'official-results';
  container.innerHTML = `<div class="official-results-title"><strong>${segHelpSearchState.results.length} resultado(s) no SEG Ajuda</strong><span>Consulta: ${escapeHtml(localDateTime(segHelpSearchState.searchedAt || nowISO()))}</span></div>${segHelpSearchState.results.map(segHelpCard).join('')}`;
}

async function searchSegHelp() {
  const query = currentSupportQuery();
  if (normalize(query).length < 2) {
    showToast('Digite o código, modelo ou dúvida antes de pesquisar');
    $('manualSearchInput')?.focus();
    return;
  }
  segHelpSearchState = { query, loading: true, error: '', results: [], searchedAt: '' };
  renderSegHelpResults();
  try {
    const response = await apiFetch(`/api/seg-help-search?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Pesquisa indisponível');
    segHelpSearchState = {
      query,
      loading: false,
      error: '',
      results: Array.isArray(data.results) ? data.results : [],
      searchedAt: data.searchedAt || nowISO()
    };
  } catch (error) {
    console.error(error);
    segHelpSearchState = { query, loading: false, error: error.message || 'Verifique a conexão com a internet.', results: [], searchedAt: '' };
  }
  renderSegHelpResults();
}

function resetManualForm() {
  editingManualId = null;
  pendingManualFile = null;
  $('manualManagerTitle').textContent = 'Cadastrar manual';
  $('manualForm').reset();
  $('manualBrand').value = 'SEG';
  $('manualVisibility').value = 'public';
  $('manualApproved').checked = true;
  $('manualCurrentFile').textContent = 'Selecione um PDF de até 20 MB.';
  $('deleteManualFromModalBtn').classList.add('hidden');
}

function openManualManager(manualId = '') {
  if (!isCurrentCoordinator()) {
    showToast('Acesso exclusivo de coordenadores');
    return;
  }
  resetManualForm();
  if (manualId) {
    const manual = serverManuals.find(item => item.id === manualId);
    if (!manual) return;
    editingManualId = manualId;
    $('manualManagerTitle').textContent = 'Editar manual';
    $('manualTitle').value = manual.title || '';
    $('manualCode').value = manual.code || '';
    $('manualModels').value = manual.models || '';
    $('manualBrand').value = manual.brand || 'SEG';
    $('manualCategory').value = manual.category || 'Outros';
    $('manualDescription').value = manual.description || '';
    $('manualVisibility').value = manual.visibility || 'public';
    $('manualApproved').checked = manual.approved !== false;
    $('manualCurrentFile').textContent = `Arquivo atual: ${manual.fileName || 'PDF cadastrado'}. Escolha outro apenas para substituir.`;
    $('deleteManualFromModalBtn').classList.remove('hidden');
  }
  $('manualManagerModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(() => $('manualTitle').focus(), 50);
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o PDF.'));
    reader.readAsDataURL(file);
  });
}

async function saveManual(event) {
  event.preventDefault();
  if (!isCurrentCoordinator()) {
    showToast('Acesso exclusivo de coordenadores');
    return;
  }
  const file = pendingManualFile;
  if (!editingManualId && !file) {
    showToast('Selecione o arquivo PDF');
    return;
  }
  if (file && file.size > 20 * 1024 * 1024) {
    showToast('O PDF deve ter no máximo 20 MB');
    return;
  }
  const button = $('saveManualBtn');
  button.disabled = true;
  button.textContent = 'Salvando…';
  try {
    const payload = {
      title: $('manualTitle').value.trim(),
      code: $('manualCode').value.trim(),
      models: $('manualModels').value.trim(),
      brand: $('manualBrand').value.trim(),
      category: $('manualCategory').value,
      description: $('manualDescription').value.trim(),
      visibility: $('manualVisibility').value,
      approved: $('manualApproved').checked
    };
    if (file) {
      payload.fileName = file.name;
      payload.fileDataBase64 = await fileAsDataUrl(file);
    }
    const url = editingManualId ? `/api/manuals/${encodeURIComponent(editingManualId)}` : '/api/manuals';
    const response = await apiFetch(url, {
      method: editingManualId ? 'PUT' : 'POST',
      headers: manualApiHeaders(true),
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível salvar o manual');
    closeModal('manualManagerModal');
    await loadServerManuals({ silent: true });
    await loadManualAudit({ silent: true });
    showToast(editingManualId ? 'Manual atualizado' : 'Manual cadastrado');
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Não foi possível salvar o manual');
  } finally {
    button.disabled = false;
    button.textContent = 'Salvar manual';
  }
}

async function deleteManual(manualId) {
  if (!isCurrentCoordinator()) {
    showToast('Acesso exclusivo de coordenadores');
    return;
  }
  const manual = serverManuals.find(item => item.id === manualId);
  if (!manual || !window.confirm(`Excluir o manual “${manual.title}”?`)) return;
  try {
    const response = await apiFetch(`/api/manuals/${encodeURIComponent(manualId)}`, {
      method: 'DELETE',
      headers: manualApiHeaders(false)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível excluir');
    closeModal('manualManagerModal');
    await loadServerManuals({ silent: true });
    await loadManualAudit({ silent: true });
    showToast('Manual excluído');
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Não foi possível excluir o manual');
  }
}

function renderManualPermissions() {
  const coordinator = isCurrentCoordinator();
  $('manageManualsBtn')?.classList.toggle('hidden', !coordinator);
  $('manualAuditCard')?.classList.toggle('hidden', !coordinator);
  if (coordinator) loadManualAudit({ silent: true });
}

async function loadManualAudit({ silent = false } = {}) {
  const list = $('manualAuditList');
  if (!list || !isCurrentCoordinator()) return;
  try {
    const response = await apiFetch('/api/manual-audit', { headers: manualApiHeaders(false), cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Falha no relatório');
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (!entries.length) {
      list.className = 'audit-list empty-state compact';
      list.textContent = 'Nenhuma alteração de manual registrada.';
      return;
    }
    list.className = 'audit-list';
    list.innerHTML = entries.slice(0, 100).map(entry => `<article class="audit-item">
      <div><span class="audit-action">${escapeHtml(entry.action)}</span><strong>${escapeHtml(entry.code ? `${entry.code} — ${entry.title}` : entry.title)}</strong></div>
      <p>${escapeHtml(entry.actor)} • ${escapeHtml(entry.store)} • ${escapeHtml(localDateTime(entry.at))}</p>
      ${entry.details ? `<small>${escapeHtml(entry.details)}</small>` : ''}
    </article>`).join('');
  } catch (error) {
    console.error(error);
    if (!silent) showToast('Não foi possível carregar o relatório de manuais');
  }
}

function activateSupportTab(tab) {
  if (currentUser?.role === 'client' && tab === 'forum') tab = 'manuals';
  document.querySelectorAll('.support-tab').forEach(button => button.classList.toggle('active', button.dataset.supportTab === tab));
  document.querySelectorAll('.support-panel').forEach(panel => panel.classList.toggle('active', panel.id === `support-${tab}`));
  if (tab === 'forum') renderForum();
}

function openManualRequest(description = '', code = '') {
  switchPage('support');
  activateSupportTab('forum');
  $('newTopicCard').classList.remove('hidden');
  $('forumTopicCategory').value = 'Solicitação de manual';
  $('forumTopicModel').value = code;
  $('forumTopicTitle').value = code ? `Solicitação de manual — código ${code}` : 'Solicitação de manual';
  $('forumTopicBody').value = description ? `Preciso do manual oficial do produto: ${description}.` : 'Preciso do manual oficial deste produto.';
  $('forumAuthorName').focus();
}

function forumRoleClass(role = '') {
  const safeRole = forumRoleOrEmpty(role) || 'Outro';
  if (FORUM_SEG_PROFILES.has(safeRole)) return 'seg';
  if (safeRole === 'Instalador' || safeRole === 'Técnico / integrador' || safeRole === 'Revendedor / parceiro') return 'installer';
  return 'client';
}

function forumRoleOrEmpty(role = '') {
  const candidate = String(role || '').trim();
  return FORUM_PROFILE_OPTIONS.includes(candidate) ? candidate : '';
}

function sanitizeForumRole(role = '', fallback = 'Instalador') {
  return forumRoleOrEmpty(role) || forumRoleOrEmpty(fallback) || 'Instalador';
}

function forumDefaultRole(user = currentUser) {
  if (user?.role === 'client') return 'Cliente';
  const accountRole = {
    seller: 'Vendedor SEG',
    coordinator: 'Coordenador SEG',
    admin: 'Colaborador SEG',
    finance: 'Financeiro SEG'
  }[user?.role];
  if (accountRole) return accountRole;
  return sanitizeForumRole(localStorage.getItem('seg_forum_last_role'), 'Instalador');
}

function forumRoleOptionsHtml(selectedRole = forumDefaultRole()) {
  const selected = sanitizeForumRole(selectedRole, forumDefaultRole());
  return FORUM_PROFILE_OPTIONS.map(role => `<option${role === selected ? ' selected' : ''}>${escapeHtml(role)}</option>`).join('');
}

function forumAnswerHtml(topicId, answer) {
  const role = sanitizeForumRole(answer.role, 'Outro');
  return `<article class="forum-answer ${answer.official ? 'official-answer' : ''}">
    <div class="forum-author-line">
      <strong>${escapeHtml(answer.author)}</strong>
      <span class="forum-role ${forumRoleClass(role)}">${escapeHtml(role)}</span>
      ${answer.official ? '<span class="official-badge">Oficial SEG</span>' : ''}
    </div>
    <p>${escapeHtml(answer.body).replace(/\n/g, '<br>')}</p>
    <div class="forum-answer-actions">
      <span>${escapeHtml(localDateTime(answer.createdAt))}</span>
      <button type="button" data-helpful-answer="${escapeHtml(answer.id)}" data-topic-id="${escapeHtml(topicId)}">👍 Ajudou (${Number(answer.helpful) || 0})</button>
    </div>
  </article>`;
}

function forumTopicHtml(topic) {
  const answers = Array.isArray(topic.answers) ? topic.answers : [];
  const officialOption = isCurrentCoordinator()
    ? `<label class="official-check span-2"><input name="official" type="checkbox"> Responder oficialmente como ${escapeHtml(currentUser?.name || currentQuote.seller)} — SEG</label>`
    : '';
  const topicRole = sanitizeForumRole(topic.role, 'Outro');
  const replyAuthor = currentUser?.role === 'client' ? '' : (currentUser?.name || '');
  return `<article class="forum-topic ${topic.solved ? 'solved' : ''}" data-topic-card="${escapeHtml(topic.id)}">
    <div class="forum-topic-head">
      <div>
        <div class="forum-tags">
          <span class="forum-category">${escapeHtml(topic.category)}</span>
          ${topic.model ? `<span class="forum-model">${escapeHtml(topic.model)}</span>` : ''}
          ${topic.solved ? '<span class="solved-badge">✓ Resolvido</span>' : '<span class="open-badge">Em aberto</span>'}
          ${topic.official ? '<span class="official-badge">Oficial SEG</span>' : ''}
        </div>
        <h3>${escapeHtml(topic.title)}</h3>
      </div>
      <button class="forum-expand-btn" data-expand-topic="${escapeHtml(topic.id)}" type="button" aria-label="Abrir tópico">⌄</button>
    </div>
    <div class="forum-author-line">
      <strong>${escapeHtml(topic.author)}</strong>
      <span class="forum-role ${forumRoleClass(topicRole)}">${escapeHtml(topicRole)}</span>
      <span>${escapeHtml(localDateTime(topic.createdAt))}</span>
    </div>
    <p class="forum-preview">${escapeHtml(topic.body)}</p>
    <div class="forum-summary">
      <span>💬 ${answers.length} ${answers.length === 1 ? 'resposta' : 'respostas'}</span>
      <span>👍 ${Number(topic.helpful) || 0}</span>
    </div>
    <div class="forum-topic-details hidden" data-topic-details="${escapeHtml(topic.id)}">
      <div class="forum-full-body">${escapeHtml(topic.body).replace(/\n/g, '<br>')}</div>
      <div class="forum-topic-actions">
        <button type="button" data-helpful-topic="${escapeHtml(topic.id)}">👍 Esta dúvida ajudou (${Number(topic.helpful) || 0})</button>
        <button type="button" data-toggle-solved="${escapeHtml(topic.id)}">${topic.solved ? 'Reabrir tópico' : 'Marcar como resolvido'}</button>
        <button class="report-btn" type="button" data-report-topic="${escapeHtml(topic.id)}">⚑ Denunciar</button>
      </div>
      <div class="forum-answers">${answers.length ? answers.map(answer => forumAnswerHtml(topic.id, answer)).join('') : '<div class="empty-answer">Ainda não há respostas.</div>'}</div>
      <form class="reply-form" data-reply-form="${escapeHtml(topic.id)}">
        <div class="form-grid two">
          <label>Seu nome<input name="author" maxlength="60" required placeholder="Nome visível" value="${escapeHtml(replyAuthor)}"></label>
          <label>Perfil<select name="role">${forumRoleOptionsHtml()}</select></label>
          <label class="span-2">Sua resposta<textarea name="body" rows="4" maxlength="2000" required placeholder="Compartilhe uma orientação clara e segura."></textarea></label>
          ${officialOption}
          <button class="btn primary span-2" type="submit">Publicar resposta</button>
        </div>
      </form>
    </div>
  </article>`;
}

function renderForum() {
  const list = $('forumList');
  if (!list) return;
  const query = normalize($('forumSearchInput').value);
  const category = $('forumCategoryFilter').value;
  const status = $('forumStatusFilter').value;
  const topics = getForumTopics().filter(topic => {
    const haystack = normalize(`${topic.title} ${topic.body} ${topic.author} ${topic.role} ${topic.category} ${topic.model} ${(topic.answers || []).map(answer => answer.body).join(' ')}`);
    const queryOk = !query || query.split(' ').every(token => haystack.includes(token));
    const categoryOk = !category || topic.category === category;
    const statusOk = !status || (status === 'solved' ? topic.solved : !topic.solved);
    return queryOk && categoryOk && statusOk;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  $('forumSearchClear').classList.toggle('hidden', !$('forumSearchInput').value.trim());
  if (!topics.length) {
    list.className = 'forum-list empty-state';
    list.textContent = 'Nenhum tópico encontrado.';
    return;
  }
  list.className = 'forum-list';
  list.innerHTML = topics.map(forumTopicHtml).join('');
  bindForumDynamicEvents();
}

function updateForumTopic(topicId, updater) {
  const topics = getForumTopics();
  const topic = topics.find(item => item.id === topicId);
  if (!topic) return;
  updater(topic);
  setForumTopics(topics);
  renderForum();
}

function bindForumDynamicEvents() {
  document.querySelectorAll('[data-expand-topic]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.expandTopic;
    const details = document.querySelector(`[data-topic-details="${CSS.escape(id)}"]`);
    details?.classList.toggle('hidden');
    button.textContent = details?.classList.contains('hidden') ? '⌄' : '⌃';
  }));
  document.querySelectorAll('[data-helpful-topic]').forEach(button => button.addEventListener('click', () => {
    updateForumTopic(button.dataset.helpfulTopic, topic => topic.helpful = (Number(topic.helpful) || 0) + 1);
  }));
  document.querySelectorAll('[data-toggle-solved]').forEach(button => button.addEventListener('click', () => {
    updateForumTopic(button.dataset.toggleSolved, topic => topic.solved = !topic.solved);
  }));
  document.querySelectorAll('[data-report-topic]').forEach(button => button.addEventListener('click', () => {
    updateForumTopic(button.dataset.reportTopic, topic => topic.reports = (Number(topic.reports) || 0) + 1);
    showToast('Denúncia registrada para análise');
  }));
  document.querySelectorAll('[data-helpful-answer]').forEach(button => button.addEventListener('click', () => {
    updateForumTopic(button.dataset.topicId, topic => {
      const answer = (topic.answers || []).find(item => item.id === button.dataset.helpfulAnswer);
      if (answer) answer.helpful = (Number(answer.helpful) || 0) + 1;
    });
  }));
  document.querySelectorAll('[data-reply-form]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const body = String(data.get('body') || '').trim();
    const typedAuthor = String(data.get('author') || '').trim();
    const official = isCurrentCoordinator() && data.get('official') === 'on';
    const author = official ? (currentUser?.name || currentQuote.seller) : typedAuthor;
    const role = official ? 'Coordenador SEG' : sanitizeForumRole(data.get('role'), forumDefaultRole());
    if (!body || (!official && !typedAuthor)) return;
    updateForumTopic(form.dataset.replyForm, topic => {
      topic.answers = Array.isArray(topic.answers) ? topic.answers : [];
      topic.answers.push({
        id: `answer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: nowISO(),
        author,
        role,
        body,
        helpful: 0,
        official
      });
    });
    showToast('Resposta publicada');
  }));
}

function publishForumTopic(event) {
  event.preventDefault();
  const author = $('forumAuthorName').value.trim();
  const title = $('forumTopicTitle').value.trim();
  const body = $('forumTopicBody').value.trim();
  if (!author || !title || !body) return;
  const topics = getForumTopics();
  topics.push({
    id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: nowISO(),
    author,
    role: sanitizeForumRole($('forumAuthorRole').value, forumDefaultRole()),
    category: $('forumTopicCategory').value,
    model: $('forumTopicModel').value.trim(),
    title,
    body,
    solved: false,
    helpful: 0,
    reports: 0,
    official: false,
    answers: []
  });
  setForumTopics(topics);
  localStorage.setItem('seg_forum_last_name', author);
  localStorage.setItem('seg_forum_last_role', sanitizeForumRole($('forumAuthorRole').value, forumDefaultRole()));
  $('newTopicForm').reset();
  $('forumAuthorName').value = author;
  const savedRole = localStorage.getItem('seg_forum_last_role');
  $('forumAuthorRole').value = sanitizeForumRole(savedRole, forumDefaultRole());
  $('newTopicCard').classList.add('hidden');
  renderForum();
  showToast('Dúvida publicada no fórum local');
}

function searchManualsForAssistant(query, limit = 3) {
  const manuals = allManuals().filter(manual => manualMatches(manual, query)).slice(0, limit);
  if (!manuals.length) return '';
  return `<div class="chat-section"><strong>Manuais e orientações encontrados:</strong>${manuals.map(manual => {
    const url = manual.url ? (manual.url.startsWith('http') ? manual.url : encodeURI(manual.url)) : '#';
    return `<div class="chat-resource"><a href="${url}" target="_blank" rel="noopener">${escapeHtml(manual.title)}</a><br><small>${escapeHtml(manual.category)}${manual.brand ? ' · ' + escapeHtml(manual.brand) : ''}</small></div>`;
  }).join('')}</div>`;
}

function searchForumForAssistant(query, limit = 3) {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return '';
  const topics = getForumTopics().filter(topic => {
    const answers = (topic.answers || []).map(a => `${a.body || ''} ${a.author || ''}`).join(' ');
    const haystack = normalize(`${topic.title || ''} ${topic.category || ''} ${topic.model || ''} ${topic.body || ''} ${answers}`);
    return tokens.every(token => haystack.includes(token));
  }).slice(0, limit);
  if (!topics.length) return '';
  return `<div class="chat-section"><strong>Dúvidas parecidas no fórum:</strong>${topics.map(topic => `<div class="chat-resource"><em>${escapeHtml(topic.category || 'Fórum')}</em> — ${escapeHtml(topic.title)} ${topic.solved ? '<span class="badge solved">Resolvido</span>' : ''}</div>`).join('')}</div>`;
}

function sendAssistantMessage(query) {
  const text = query.trim();
  if (!text) return;
  const messages = $('chatMessages');
  messages.insertAdjacentHTML('beforeend', `<div class="chat-message user">${escapeHtml(text)}</div>`);
  messages.insertAdjacentHTML('beforeend', `<div class="chat-message bot">${assistantReply(text)}</div>`);
  messages.querySelectorAll('[data-chat-product]').forEach(button => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => { addProduct(Number(button.dataset.chatProduct)); switchPage('quote'); });
  });
  messages.querySelectorAll('[data-chat-sales]').forEach(button => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => openSalesContact(Number(button.dataset.chatSales)));
  });
  messages.scrollTop = messages.scrollHeight;
}

function switchPage(page) {
  document.querySelectorAll('.page').forEach(section => section.classList.toggle('active', section.id === `page-${page}`));
  document.querySelectorAll('.nav-btn').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  if (page === 'history') renderHistory();
  if (page === 'support') { renderManuals(); renderForum(); renderManualPermissions(); }
  if (page === 'settings') { renderPhotoPermissions(); renderManualPermissions(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateConnection() {
  $('connectionStatus').classList.toggle('offline', !navigator.onLine);
  $('connectionStatus').title = navigator.onLine ? 'Online' : 'Offline';
}

function initSelect(id, values) {
  $(id).innerHTML = values.map(value => `<option>${escapeHtml(value)}</option>`).join('');
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(button => button.addEventListener('click', () => switchPage(button.dataset.page)));
  bindQuoteWizardEvents();


  document.querySelectorAll('.support-tab').forEach(button => button.addEventListener('click', () => activateSupportTab(button.dataset.supportTab)));
  const manualSearch = () => renderManuals(false);
  $('manualSearchInput').addEventListener('input', manualSearch);
  $('manualSearchInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); searchSegHelp(); } });
  $('manualCategoryFilter').addEventListener('change', manualSearch);
  $('manualSearchClear').addEventListener('click', () => { $('manualSearchInput').value = ''; renderManuals(false); $('manualSearchInput').focus(); });
  $('showAllManualsBtn').addEventListener('click', () => renderManuals(true));
  $('manageManualsBtn').addEventListener('click', () => openManualManager());
  $('searchSegHelpBtn').addEventListener('click', searchSegHelp);
  $('openSegHelpSiteBtn').addEventListener('click', () => openOfficialSource('seg'));
  $('searchHikvisionBtn').addEventListener('click', () => openOfficialSource('hikvision'));
  $('searchJflBtn').addEventListener('click', () => openOfficialSource('jfl'));
  $('searchIpecBtn').addEventListener('click', () => openOfficialSource('ipec'));
  $('searchGarenBtn').addEventListener('click', () => openOfficialSource('garen'));
  $('supportWhatsappBtn').addEventListener('click', openSupportWhatsapp);

  $('newTopicBtn').addEventListener('click', () => {
    $('newTopicCard').classList.toggle('hidden');
    if (!$('newTopicCard').classList.contains('hidden')) $('forumAuthorName').focus();
  });
  $('cancelTopicBtn').addEventListener('click', () => $('newTopicCard').classList.add('hidden'));
  $('newTopicForm').addEventListener('submit', publishForumTopic);
  $('forumSearchInput').addEventListener('input', renderForum);
  $('forumSearchClear').addEventListener('click', () => { $('forumSearchInput').value = ''; renderForum(); $('forumSearchInput').focus(); });
  $('forumCategoryFilter').addEventListener('change', renderForum);
  $('forumStatusFilter').addEventListener('change', renderForum);

  const quoteSearch = () => {
    renderSearch('quoteSearchInput','quoteSearchClear','quoteSearchResults','quote');
    const query = $('quoteSearchInput')?.value.trim();
    if (query && query.length >= 2) {
      updateSeguitoAssistant(query);
    }
  };
  const catalogSearch = () => renderSearch('catalogSearchInput','catalogSearchClear','catalogResults','catalog');
  $('quoteSearchInput').addEventListener('input', quoteSearch);
  $('catalogSearchInput').addEventListener('input', catalogSearch);
  $('quoteSearchClear').addEventListener('click', () => { $('quoteSearchInput').value = ''; quoteSearch(); $('quoteSearchInput').focus(); });
  $('catalogSearchClear').addEventListener('click', () => { $('catalogSearchInput').value = ''; catalogSearch(); $('catalogSearchInput').focus(); });

  $('clearClientBtn').addEventListener('click', () => {
    ['clientName','clientCode','clientDocument','clientPhone','clientIE','clientAddress'].forEach(id => $(id).value = '');
    $('clientCity').value = 'RIO DE JANEIRO'; $('clientState').value = 'RJ';
    refreshQuoteGuideState();
  });
  $('clearCartBtn').addEventListener('click', () => {
    if (!currentQuote.items.length || window.confirm('Remover todos os itens?')) { currentQuote.items = []; renderCart(); }
  });
  $('storeSelect').addEventListener('change', () => {
    const previousPrefix = quotePrefixForStore(currentQuote.store);
    currentQuote.store = $('storeSelect').value;
    // Um orçamento ainda não salvo pode trocar de filial. Nesse caso, a
    // numeração acompanha a nova filial; pedidos já salvos preservam o número
    // original para manter a rastreabilidade.
    if (!currentQuote.id && previousPrefix !== quotePrefixForStore(currentQuote.store)) {
      currentQuote.number = nextNumber(currentQuote.store);
      $('quoteNumberBadge').textContent = `Nº ${currentQuote.number}`;
    }
    currentQuote.seller = populateSellerSelect(currentQuote.store, '');
    updateDiscountPolicyUI({ clamp: true, applyPromotion: true });
    renderPhotoPermissions();
    renderManualPermissions();
    refreshVisibleProductResults();
    renderForum();
  });
  $('sellerSelect').addEventListener('change', () => {
    currentQuote.seller = $('sellerSelect').value;
    updateDiscountPolicyUI({ clamp: true, applyPromotion: true });
    renderPhotoPermissions();
    renderManualPermissions();
    refreshVisibleProductResults();
    renderForum();
  });
  $('discountInput').addEventListener('input', () => updateDiscountPolicyUI({ clamp: false }));
  $('discountInput').addEventListener('change', () => updateDiscountPolicyUI({ clamp: true }));
  $('freightInput').addEventListener('change', () => { currentQuote.freight = parseBR($('freightInput').value); $('freightInput').value = formatInputMoney(currentQuote.freight); renderTotals(); });
  $('freightInput').addEventListener('focus', e => e.target.select());

  $('saveQuoteBtn').addEventListener('click', () => saveQuote());
  $('printQuoteBtn').addEventListener('click', () => printQuote(currentQuote));
  $('sharePhotoBtn').addEventListener('click', shareQuoteAsPhoto);
  $('sharePdfBtn').addEventListener('click', shareQuoteAsPdf);
  $('shareWhatsappBtn').addEventListener('click', shareWhatsapp);
  $('sendQuoteModalBtn').addEventListener('click', openSendQuoteModal);
  $('sendQuoteWhatsappBtn').addEventListener('click', sendQuoteViaWhatsapp);
  $('sendQuoteEmailBtn').addEventListener('click', sendQuoteViaEmail);
  document.querySelector('[data-skip-client]')?.addEventListener('click', () => showQuoteStep(3));
  $('newQuoteBtn').addEventListener('click', () => newQuote(true));
  $('exportHistoryBtn').addEventListener('click', exportHistory);
  $('exportHistoryCsvBtn')?.addEventListener('click', exportFilteredHistoryCsv);
  bindHistoryFilters();

  $('chatForm').addEventListener('submit', event => {
    event.preventDefault();
    sendAssistantMessage($('chatInput').value);
    $('chatInput').value = '';
  });

  $('saveSettingsBtn').addEventListener('click', () => {
    const settings = getSettings();
    settings.site = $('companySite').value.trim();
    settings.phones = $('companyPhones').value.trim();
    settings.logoChoice = $('logoChoiceSelect').value;
    localStorage.setItem('seg_settings', JSON.stringify(settings));
    applyBranding();
    showToast('Configurações salvas');
  });

  $('logoChoiceSelect').addEventListener('change', () => {
    const settings = getSettings();
    settings.logoChoice = $('logoChoiceSelect').value;
    localStorage.setItem('seg_settings', JSON.stringify(settings));
    $('customLogoLabel').classList.toggle('hidden', settings.logoChoice !== 'custom');
    applyBranding();
  });
  $('customLogoInput').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_500_000) { showToast('Escolha uma imagem com até 2,5 MB'); event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const settings = getSettings();
      settings.logoChoice = 'custom';
      settings.customLogoData = String(reader.result || '');
      localStorage.setItem('seg_settings', JSON.stringify(settings));
      $('logoChoiceSelect').value = 'custom';
      applyBranding();
      showToast('Nova logo aplicada');
    };
    reader.readAsDataURL(file);
  });
  $('resetLogoBtn').addEventListener('click', () => {
    const settings = getSettings();
    settings.logoChoice = 'standard';
    settings.customLogoData = '';
    localStorage.setItem('seg_settings', JSON.stringify(settings));
    updateLogoControls(); applyBranding();
    $('customLogoInput').value = '';
    showToast('Logo padrão restaurada');
  });

  $('manualForm').addEventListener('submit', saveManual);
  $('manualPdfInput').addEventListener('change', event => {
    pendingManualFile = event.target.files?.[0] || null;
    $('manualCurrentFile').textContent = pendingManualFile
      ? `Novo arquivo: ${pendingManualFile.name} (${(pendingManualFile.size / 1024 / 1024).toFixed(1)} MB)`
      : (editingManualId ? 'O PDF atual será mantido.' : 'Selecione um PDF de até 20 MB.');
  });
  $('deleteManualFromModalBtn').addEventListener('click', () => editingManualId && deleteManual(editingManualId));

  $('salesStoreSelect').addEventListener('change', populateSalesSellerSelect);
  $('openSellerWhatsappBtn').addEventListener('click', openSellerWhatsapp);
  $('photoFileInput').addEventListener('change', event => handleProductPhotoUpload(event.target.files?.[0]));
  $('photoCameraInput')?.addEventListener('change', event => handleProductPhotoUpload(event.target.files?.[0]));
  $('removeProductPhotoBtn').addEventListener('click', removePendingProductPhoto);
  $('exportPhotoAuditBtn').addEventListener('click', exportPhotoAudit);
  document.querySelectorAll('[data-close-modal]').forEach(element => element.addEventListener('click', () => closeModal(element.dataset.closeModal)));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeModal('salesContactModal');
    closeModal('sendQuoteModal');
    closeModal('productPhotoModal');
    closeModal('manualManagerModal');
  });

  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $('installBtn').classList.remove('hidden');
  });
  $('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('installBtn').classList.add('hidden');
  });
}

function init() {
  initSelect('storeSelect', STORES);
  const initialStore = STORES.includes(currentQuote.store) ? currentQuote.store : STORES[0];
  $('storeSelect').value = initialStore;
  currentQuote.store = initialStore;
  currentQuote.seller = populateSellerSelect(initialStore, currentQuote.seller);
  currentQuote.sellerRole = sellerProfile(currentQuote.store, currentQuote.seller)?.role || 'seller';
  const settings = getSettings();
  $('companySite').value = settings.site;
  $('companyPhones').value = settings.phones;
  $('productCountLabel').textContent = `${productIndex.length.toLocaleString('pt-BR')} itens`;
  updateLogoControls();
  applyBranding();
  $('forumAuthorName').value = localStorage.getItem('seg_forum_last_name') || '';
  const rememberedForumRole = localStorage.getItem('seg_forum_last_role');
  $('forumAuthorRole').value = sanitizeForumRole(rememberedForumRole, forumDefaultRole());
  bindEvents();
  populateQuoteForm();
  renderManualPermissions();
  loadServerManuals({ silent: true });
  renderHistory();
  updateConnection();
  // Service worker desativado na versão local para evitar telas antigas em cache.
}


// ============================


// VERSÃO 5.4.1 — FLUXO DO ORÇAMENTO EM QUATRO PÁGINAS CLICÁVEIS
function quoteStepCompleted(step) {
  if (step === 1) return Boolean($('storeSelect')?.value && $('sellerSelect')?.value && $('paymentSelect')?.value);
  if (step === 2) return Boolean($('clientName')?.value.trim());
  if (step === 3) return Boolean(currentQuote.items?.length);
  if (step === 4) return Boolean(currentQuote.id);
  return false;
}

function refreshQuoteGuideState() {
  document.querySelectorAll('.guide-step[data-step]').forEach(stepEl => {
    const step = Number(stepEl.dataset.step);
    const active = step === currentQuoteStep;
    stepEl.classList.toggle('active', active);
    stepEl.classList.toggle('completed', !active && quoteStepCompleted(step));
    if (active) stepEl.setAttribute('aria-current', 'step');
    else stepEl.removeAttribute('aria-current');
  });
}

function showQuoteStep(step, { scroll = true, focus = true } = {}) {
  const target = Math.min(4, Math.max(1, Number(step) || 1));
  const panel = document.querySelector(`[data-quote-step-panel="${target}"]`);
  if (!panel) return;
  currentQuoteStep = target;
  document.querySelectorAll('[data-quote-step-panel]').forEach(item => {
    const active = Number(item.dataset.quoteStepPanel) === target;
    item.classList.toggle('active', active);
    item.setAttribute('aria-hidden', active ? 'false' : 'true');
  });
  if (target === 4) {
    syncFormToQuote();
    renderTotals();
  }
  refreshQuoteGuideState();
  updateSeguitoTip();
  if (scroll) {
    const guide = document.querySelector('.quote-guide');
    const top = Math.max(0, (guide?.getBoundingClientRect().top || 0) + window.scrollY - 78);
    window.scrollTo({ top, behavior: 'smooth' });
  }
  if (focus) setTimeout(() => panel.focus({ preventScroll: true }), 180);
}

function bindQuoteWizardEvents() {
  document.querySelectorAll('.guide-step[data-step]').forEach(stepEl => {
    const open = () => showQuoteStep(Number(stepEl.dataset.step));
    stepEl.addEventListener('click', open);
    stepEl.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
  document.querySelectorAll('[data-quote-next]').forEach(button => button.addEventListener('click', () => showQuoteStep(Number(button.dataset.quoteNext))));
  document.querySelectorAll('[data-quote-prev]').forEach(button => button.addEventListener('click', () => showQuoteStep(Number(button.dataset.quotePrev))));
  ['clientName','clientCode','clientDocument','clientPhone','clientIE','clientAddress','clientCity','clientState','paymentSelect','validitySelect']
    .forEach(id => $(id)?.addEventListener('input', refreshQuoteGuideState));
}


// VERSÃO 5.4.1 — LOGIN, MENU POR PERFIL E ORÇAMENTO EM ETAPAS
// ============================

async function apiFetch(input, options = {}) {
  const config = { ...options };
  const headers = new Headers(options.headers || {});
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  config.headers = headers;
  const response = await window.fetch(input, config);
  if (response.status === 401 && !String(input).includes('/api/login') && !String(input).includes('/api/register') && !String(input).includes('/api/session')) {
    authToken = '';
    currentUser = null;
    sessionStorage.removeItem('seg_auth_token');
    showLoginScreen('Sua sessão expirou. Entre novamente.', 'worried');
  }
  return response;
}

function roleLabel(role) {
  if (role === 'admin') return 'Administrador(a)';
  if (role === 'coordinator') return 'Coordenador(a)';
  if (role === 'client') return 'Cliente';
  if (role === 'finance') return 'Financeiro';
  return 'Vendedor(a)';
}

function isCurrentCoordinator() {
  return ['coordinator', 'admin'].includes(currentUser?.role || '');
}

function discountPolicy(quote = currentQuote) {
  const role = currentUser?.role || sellerProfile(quote.store, quote.seller)?.role || 'seller';
  if (role === 'coordinator' || role === 'admin') {
    return { role: 'coordinator', actualRole: role, max: 100, label: role === 'admin' ? 'Administrador: desconto livre' : 'Coordenador: desconto livre', promotion: isPromotionQuote(quote) };
  }
  if (isPromotionQuote(quote)) {
    return { role: 'seller', actualRole: role, max: PROMOTION_SELLER_DISCOUNT, label: 'Promoção de 31/07: vendedor pode aplicar até 8%', promotion: true };
  }
  return { role: 'seller', actualRole: role, max: NORMAL_SELLER_DISCOUNT_MAX, label: 'Vendedor: desconto máximo de 4%', promotion: false };
}

function populateSellerSelect(store, preferredSeller = '') {
  const select = $('sellerSelect');
  if (currentUser && ['seller', 'coordinator'].includes(currentUser.role)) {
    select.innerHTML = `<option value="${escapeHtml(currentUser.name)}">${escapeHtml(currentUser.name)}${currentUser.role === 'coordinator' ? ' — Coordenador(a)' : ''}</option>`;
    select.value = currentUser.name;
    select.disabled = true;
    $('storeSelect').disabled = true;
    return currentUser.name;
  }
  if (currentUser?.role === 'admin') {
    select.innerHTML = `<option value="${escapeHtml(currentUser.name)}">${escapeHtml(currentUser.name)} — Administrador(a)</option>`;
    select.value = currentUser.name;
    select.disabled = true;
    $('storeSelect').disabled = false;
    return currentUser.name;
  }
  const sellers = sellersForStore(store);
  select.innerHTML = sellers.map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}${item.role === 'coordinator' ? ' — Coordenador(a)' : ''}</option>`).join('');
  const selected = sellers.some(item => item.name === preferredSeller) ? preferredSeller : sellers.find(item => item.role === 'seller')?.name || sellers[0]?.name || '';
  select.value = selected;
  select.disabled = false;
  $('storeSelect').disabled = false;
  return selected;
}

function updateDiscountPolicyUI({ clamp = true, applyPromotion = false } = {}) {
  currentQuote.store = $('storeSelect').value || currentQuote.store;
  currentQuote.seller = $('sellerSelect').value || currentQuote.seller;
  currentQuote.sellerRole = currentUser?.role || sellerProfile(currentQuote.store, currentQuote.seller)?.role || 'seller';
  const policy = discountPolicy(currentQuote);
  const input = $('discountInput');
  input.max = String(policy.max);
  $('sellerRoleBadge').textContent = roleLabel(policy.actualRole || policy.role);
  $('sellerRoleBadge').classList.toggle('coordinator', policy.role === 'coordinator');
  $('discountPolicyHint').textContent = policy.label;
  $('promotionBanner').classList.toggle('hidden', !policy.promotion);
  if (applyPromotion && policy.promotion && policy.role === 'seller' && parseBR(input.value) === 0) input.value = PROMOTION_SELLER_DISCOUNT;
  const entered = parseBR(input.value);
  if (clamp && policy.role !== 'coordinator' && entered > policy.max) {
    input.value = policy.max;
    currentQuote.discount = policy.max;
    showToast(`Limite de desconto: ${numberBR.format(policy.max)}%`);
  } else currentQuote.discount = Math.min(100, Math.max(0, entered));
  renderTotals();
}

function syncFormToQuote() {
  currentQuote.store = $('storeSelect').value;
  currentQuote.seller = $('sellerSelect').value;
  currentQuote.sellerRole = currentUser?.role || sellerProfile(currentQuote.store, currentQuote.seller)?.role || 'seller';
  currentQuote.payment = $('paymentSelect').value;
  currentQuote.validity = Number($('validitySelect').value) || 7;
  currentQuote.client = {
    name: $('clientName').value.trim(), code: $('clientCode').value.trim(), document: $('clientDocument').value.trim(),
    phone: $('clientPhone').value.trim(), ie: $('clientIE').value.trim(), address: $('clientAddress').value.trim(),
    city: $('clientCity').value.trim(), state: $('clientState').value.trim().toUpperCase()
  };
  currentQuote.discount = Math.min(100, Math.max(0, parseBR($('discountInput').value)));
  currentQuote.freight = Math.max(0, parseBR($('freightInput').value));
  currentQuote.notes = $('notesInput').value.trim();
  localStorage.setItem('seg_last_seller', currentQuote.seller);
  localStorage.setItem('seg_last_store', currentQuote.store);
}

function setSeguitoLoginState(state, message = '') {
  const mascot = $('seguitoLogin');
  if (!mascot) return;
  mascot.classList.remove('serious', 'attentive', 'happy', 'worried');
  mascot.classList.add(state);
  if (message) $('seguitoLoginMessage').textContent = message;
}

function showLoginScreen(message = 'Digite seu código ou usuário e sua senha.', state = 'serious') {
  $('homeScreen')?.classList.add('hidden');
  document.body.classList.add('auth-locked');
  $('loginScreen').classList.remove('hidden');
  $('loggedUserChip').classList.add('hidden');
  $('homeBtn')?.classList.add('hidden');
  $('changePasswordBtn')?.classList.add('hidden');
  $('logoutBtn').classList.add('hidden');
  $('seguitoDock').classList.add('hidden');
  setSeguitoLoginState(state, message);
  setTimeout(() => $('loginUsername')?.focus(), 80);
}

function hideLoginScreen() {
  $('loginScreen').classList.add('hidden');
}

function configureHomeForRole() {
  const restrictedMode = ['client', 'finance'].includes(currentUser?.role || '');
  document.querySelectorAll('.staff-home-option').forEach(button => button.classList.toggle('role-hidden', restrictedMode));
  $('quickAccessGrid')?.classList.toggle('client-home-mode', restrictedMode);
  $('homeWelcomeMessage').textContent = restrictedMode
    ? `Olá, ${currentUser?.name || 'cliente'}! Você pode consultar o catálogo e os manuais.`
    : `Olá, ${currentUser?.name || 'usuário'}! Escolha uma opção para continuar.`;
}

function showHomeScreen() {
  if (!currentUser) {
    showLoginScreen();
    return;
  }
  hideLoginScreen();
  configureHomeForRole();
  document.body.classList.add('auth-locked');
  $('homeScreen').classList.remove('hidden');
  $('seguitoDock').classList.add('hidden');
  window.scrollTo({ top: 0 });
}

function hideHomeScreen() {
  $('homeScreen')?.classList.add('hidden');
  document.body.classList.remove('auth-locked');
  if (currentUser) $('seguitoDock').classList.remove('hidden');
}

// A aba "Assistente" está desativada até a integração com o bot de inteligência.
function permittedPagesForRole(role) {
  if (role === 'client' || role === 'finance') return ['products', 'support'];
  if (role === 'seller') return ['quote', 'products', 'support', 'history'];
  return ['quote', 'products', 'support', 'history', 'settings'];
}

function applyRoleVisibility() {
  const role = currentUser?.role || 'client';
  const allowed = permittedPagesForRole(role);
  document.querySelectorAll('.nav-btn').forEach(button => button.classList.toggle('role-hidden', !allowed.includes(button.dataset.page)));
  document.querySelectorAll('.page').forEach(page => page.classList.toggle('role-hidden', !allowed.includes(page.id.replace('page-', ''))));
  $('searchClientBtn')?.classList.toggle('hidden', !['seller', 'coordinator', 'admin'].includes(role));
  document.querySelectorAll('.coordinator-only').forEach(el => el.classList.toggle('hidden', !isCurrentCoordinator()));
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', role !== 'admin'));

  const clientMode = role === 'client';
  document.body.classList.toggle('client-manual-mode', clientMode);
  $('forumTabBtn')?.classList.toggle('role-hidden', clientMode);
  $('supportPageTitle').textContent = clientMode ? 'Manuais técnicos' : 'Manuais e comunidade';
  if (clientMode) activateSupportTab('manuals');

  const active = document.querySelector('.page.active')?.id.replace('page-', '');
  if (!allowed.includes(active)) switchPage(allowed[0]);
  configureHomeForRole();
}

function applyAuthenticatedUser(user) {
  currentUser = user;
  const previousPrefix = quotePrefixForStore(currentQuote.store);
  $('loggedUserName').textContent = user.name;
  $('loggedUserRole').textContent = roleLabel(user.role);
  const loggedUserInitial = $('loggedUserInitial');
  const loggedUserLetter = (user.name || 'S').trim().charAt(0).toUpperCase();
  const loggedUserTextNode = [...loggedUserInitial.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
  if (loggedUserTextNode) loggedUserTextNode.nodeValue = loggedUserLetter;
  else loggedUserInitial.prepend(document.createTextNode(loggedUserLetter));
  $('loggedUserChip').classList.remove('hidden');
  $('homeBtn')?.classList.remove('hidden');
  $('changePasswordBtn')?.classList.remove('hidden');
  $('logoutBtn').classList.remove('hidden');
  if (['seller', 'coordinator'].includes(user.role)) {
    currentQuote.store = user.store;
    currentQuote.seller = user.name;
    currentQuote.sellerRole = user.role;
  } else if (user.role === 'admin') {
    currentQuote.store = user.store || STORES[0];
    currentQuote.seller = user.name;
    currentQuote.sellerRole = 'admin';
  }
  if (!currentQuote.id && previousPrefix !== quotePrefixForStore(currentQuote.store)) {
    currentQuote.number = nextNumber(currentQuote.store);
  }
  $('storeSelect').value = currentQuote.store || STORES[0];
  currentQuote.seller = populateSellerSelect($('storeSelect').value, currentQuote.seller);
  populateQuoteForm();
  applyRoleVisibility();
  renderPhotoPermissions();
  renderManualPermissions();
  $('forumAuthorName').value = user.role === 'client' ? (localStorage.getItem('seg_forum_last_name') || '') : user.name;
  $('forumAuthorRole').value = forumDefaultRole(user);
  if (!user.mustChangePassword) {
    loadServerManuals({ silent: true });
    loadServerPhotos({ silent: true });
    syncQuoteHistoryWithServer({ silent: true });
    if (isCurrentCoordinator()) {
      loadPhotoAudit({ silent: true });
      loadManualAudit({ silent: true });
      loadClientImportAudit({ silent: true });
    }
    if (user.role === 'admin') {
      loadAccessRequests({ notify: true });
      loadPasswordResetRequests({ notify: true });
    }
  }
  updateSeguitoTip();
}

async function restoreSession() {
  if (!authToken) {
    showLoginScreen();
    return;
  }
  try {
    const response = await apiFetch('/api/session', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error('Sessão inválida');
    applyAuthenticatedUser(data.user);
    showHomeScreen();
  } catch {
    authToken = '';
    sessionStorage.removeItem('seg_auth_token');
    showLoginScreen();
  }
}

async function submitLogin(event) {
  event.preventDefault();
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  const button = $('loginSubmitBtn');
  $('loginError').classList.add('hidden');
  setSeguitoLoginState('attentive', 'Conferindo seus dados…');
  button.disabled = true;
  button.textContent = 'Entrando…';
  try {
    const response = await apiFetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível entrar.');
    authToken = data.token;
    sessionStorage.setItem('seg_auth_token', authToken);
    setSeguitoLoginState('happy', `Olá, ${data.user.name}! Que bom ter você por aqui.`);
    applyAuthenticatedUser(data.user);
    await new Promise(resolve => setTimeout(resolve, 450));
    showHomeScreen();
  } catch (error) {
    setSeguitoLoginState('worried', 'Não consegui confirmar seus dados.');
    const directFileMessage = location.protocol === 'file:'
      ? 'O login não funciona abrindo index.html diretamente. Feche esta página e execute iniciar_app.bat.'
      : '';
    $('loginError').textContent = directFileMessage || error.message || 'Código, usuário ou senha incorretos.';
    $('loginError').classList.remove('hidden');
    $('loginPassword').select();
  } finally {
    button.disabled = false;
    button.textContent = 'Entrar';
  }
}

function openRegisterModal() {
  $('registerForm').reset();
  $('registerError').classList.add('hidden');
  openModal('registerModal');
  setTimeout(() => $('registerName')?.focus(), 80);
}

function formatAccessDocument(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return digits;
}

async function loadAccessRequests({ notify = false } = {}) {
  if (currentUser?.role !== 'admin') return;
  const list = $('accessRequestsList');
  try {
    const response = await apiFetch('/api/access-requests');
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível consultar as solicitações.');
    const requests = Array.isArray(data.requests) ? data.requests : [];
    if (!requests.length) {
      list.className = 'audit-list empty-state compact';
      list.textContent = 'Nenhuma solicitação aguardando aprovação.';
      return;
    }
    list.className = 'audit-list';
    list.innerHTML = requests.map(item => `<article class="audit-item access-request-item">
      <div><span class="audit-action">Aguardando aprovação</span><strong>${escapeHtml(item.name)}</strong></div>
      <p>CPF/CNPJ: ${escapeHtml(formatAccessDocument(item.document))} · Usuário: ${escapeHtml(item.username)}</p>
      <small>${escapeHtml(item.email || 'E-mail não informado')} · ${escapeHtml(item.phone || 'Telefone não informado')}</small>
      <button class="btn primary compact-btn" data-approve-access="${escapeHtml(item.id)}" type="button">Liberar acesso como cliente</button>
    </article>`).join('');
    list.querySelectorAll('[data-approve-access]').forEach(button => button.addEventListener('click', () => approveAccessRequest(button.dataset.approveAccess, button)));
    if (notify) showToast(`${requests.length} solicitação${requests.length === 1 ? '' : 'ões'} de acesso aguardando aprovação.`);
  } catch (error) {
    list.className = 'audit-list empty-state compact';
    list.textContent = error.message || 'Solicitações indisponíveis.';
  }
}

async function approveAccessRequest(id, button) {
  if (currentUser?.role !== 'admin') return;
  button.disabled = true;
  button.textContent = 'Liberando…';
  try {
    const response = await apiFetch(`/api/access-requests/${encodeURIComponent(id)}/approve`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível liberar o acesso.');
    showToast('Acesso de cliente liberado com sucesso.');
    await loadAccessRequests();
  } catch (error) {
    showToast(error.message || 'Não foi possível liberar o acesso.');
    button.disabled = false;
    button.textContent = 'Liberar acesso como cliente';
  }
}

async function loadPasswordResetRequests({ notify = false } = {}) {
  if (currentUser?.role !== 'admin') return;
  const list = $('passwordResetRequestsList');
  if (!list) return;
  try {
    const response = await apiFetch('/api/password-reset-requests', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível consultar os pedidos de recuperação.');
    const requests = Array.isArray(data.requests) ? data.requests : [];
    if (!requests.length) {
      list.className = 'audit-list empty-state compact';
      list.textContent = 'Nenhum pedido de recuperação aguardando aprovação.';
      return;
    }
    list.className = 'audit-list';
    list.innerHTML = requests.map(item => {
      const created = item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : 'Horário não informado';
      return `<article class="audit-item access-request-item">
        <div><span class="audit-action">Recuperação aguardando</span><strong>${escapeHtml(item.name || item.username || item.code)}</strong></div>
        <p>Código: ${escapeHtml(item.code || 'não informado')} · Usuário: ${escapeHtml(item.username || 'não informado')}</p>
        <small>${escapeHtml(roleLabel(item.role || 'seller'))} · ${escapeHtml(item.store || 'Loja não informada')} · ${escapeHtml(created)}</small>
        <button class="btn primary compact-btn" data-approve-password-reset="${escapeHtml(item.id)}" type="button">Restaurar para SEG@código</button>
      </article>`;
    }).join('');
    list.querySelectorAll('[data-approve-password-reset]').forEach(button => button.addEventListener('click', () => approvePasswordResetRequest(button.dataset.approvePasswordReset, button)));
    if (notify) showToast(`${requests.length} pedido${requests.length === 1 ? '' : 's'} de recuperação de senha aguardando autorização.`);
  } catch (error) {
    list.className = 'audit-list empty-state compact';
    list.textContent = error.message || 'Pedidos de recuperação indisponíveis.';
  }
}

async function approvePasswordResetRequest(id, button) {
  if (currentUser?.role !== 'admin') return;
  button.disabled = true;
  button.textContent = 'Restaurando…';
  try {
    const response = await apiFetch(`/api/password-reset-requests/${encodeURIComponent(id)}/approve`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível restaurar a senha.');
    showToast(`Senha restaurada. O funcionário ${data.code || ''} já pode entrar com SEG@código.`);
    await loadPasswordResetRequests();
  } catch (error) {
    showToast(error.message || 'Não foi possível restaurar a senha.');
    button.disabled = false;
    button.textContent = 'Restaurar para SEG@código';
  }
}

async function submitRegistration(event) {
  event.preventDefault();
  const errorEl = $('registerError');
  const button = $('registerSubmitBtn');
  const password = $('registerPassword').value;
  const confirmation = $('registerPasswordConfirm').value;
  errorEl.classList.add('hidden');
  if (password !== confirmation) {
    errorEl.textContent = 'As senhas não são iguais.';
    errorEl.classList.remove('hidden');
    $('registerPasswordConfirm').focus();
    return;
  }
  button.disabled = true;
  button.textContent = 'Criando cadastro…';
  try {
    const payload = {
      name: $('registerName').value.trim(),
      document: $('registerDocument').value.trim(),
      phone: $('registerPhone').value.trim(),
      email: $('registerEmail').value.trim(),
      username: $('registerUsername').value.trim(),
      password
    };
    const response = await apiFetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível criar o cadastro.');
    if (data.pending) {
      closeModal('registerModal');
      showToast(data.message || 'Solicitação enviada para aprovação da SEG.');
      setSeguitoLoginState('attentive', 'Sua solicitação foi enviada. Aguarde a liberação de um administrador SEG.');
      return;
    }
    authToken = data.token;
    sessionStorage.setItem('seg_auth_token', authToken);
    closeModal('registerModal');
    applyAuthenticatedUser(data.user);
    showToast('Cadastro criado com sucesso');
    showHomeScreen();
  } catch (error) {
    errorEl.textContent = location.protocol === 'file:'
      ? 'O cadastro não funciona abrindo index.html diretamente. Feche esta página e execute iniciar_app.bat.'
      : (error.message || 'Não foi possível criar o cadastro.');
    errorEl.classList.remove('hidden');
  } finally {
    button.disabled = false;
    button.textContent = 'Criar meu cadastro';
  }
}

async function logout() {
  try { await apiFetch('/api/logout', { method: 'POST' }); } catch {}
  authToken = '';
  currentUser = null;
  sessionStorage.removeItem('seg_auth_token');
  $('loginUsername').value = '';
  $('loginPassword').value = '';
  $('homeScreen')?.classList.add('hidden');
  document.body.classList.remove('client-manual-mode');
  showLoginScreen('Até logo! Digite seus dados para entrar novamente.', 'serious');
}

function openChangePasswordModal() {
  if (!currentUser) return;
  $('changePasswordForm').reset();
  $('changePasswordError').classList.add('hidden');
  openModal('changePasswordModal');
  setTimeout(() => $('currentPassword')?.focus(), 60);
}

async function submitPasswordChange(event) {
  event.preventDefault();
  const currentPassword = $('currentPassword').value;
  const newPassword = $('newPassword').value;
  const confirmation = $('confirmNewPassword').value;
  const errorEl = $('changePasswordError');
  const button = $('savePasswordBtn');
  errorEl.classList.add('hidden');
  if (newPassword.length < 8 || !/[A-Za-zÀ-ÿ]/.test(newPassword) || !/\d/.test(newPassword)) {
    errorEl.textContent = 'A nova senha precisa ter pelo menos 8 caracteres, com letras e números.';
    errorEl.classList.remove('hidden');
    return;
  }
  if (newPassword !== confirmation) {
    errorEl.textContent = 'A confirmação não corresponde à nova senha.';
    errorEl.classList.remove('hidden');
    return;
  }
  button.disabled = true;
  button.textContent = 'Salvando…';
  try {
    const response = await apiFetch('/api/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível trocar a senha.');
    if (data.token) {
      authToken = data.token;
      sessionStorage.setItem('seg_auth_token', authToken);
    }
    if (data.user) currentUser = data.user;
    closeModal('changePasswordModal');
    showToast('Senha alterada com sucesso');
  } catch (error) {
    errorEl.textContent = error.message || 'Não foi possível trocar a senha.';
    errorEl.classList.remove('hidden');
  } finally {
    button.disabled = false;
    button.textContent = 'Salvar nova senha';
  }
}

function handleQuickAccess(action) {
  if (!currentUser) {
    showLoginScreen('Entre para acessar esta função.', 'worried');
    return;
  }
  const clientMode = currentUser.role === 'client';
  if (clientMode && !['catalog', 'manuals'].includes(action)) {
    showToast('Clientes têm acesso somente ao catálogo e aos manuais.');
    return;
  }
  hideHomeScreen();
  switch (action) {
    case 'quote':
      currentQuoteStep = 1;
      switchPage('quote');
      showQuoteStep(1, { scroll: false, focus: false });
      break;
    case 'catalog':
      switchPage('products');
      break;
    case 'manuals':
      switchPage('support');
      activateSupportTab('manuals');
      break;
    case 'clients':
      switchPage('quote');
      showQuoteStep(2, { scroll: false, focus: false });
      setTimeout(() => $('searchClientBtn')?.click(), 250);
      break;
  }
}

function navigateToPage(pageId) {
  hideHomeScreen();
  switchPage(pageId);
}

// Assistente Nestor
const seguitoResponses = {
  camera: [
    "Temos várias opções de câmeras! Você procura câmeras para interno ou externo?",
    "Para câmeras, recomendo verificar a resolução e visão noturna. Qual seu orçamento?",
    "Câmeras Colorvu são ótimas para ambientes com pouca luz. Quer ver algumas opções?"
  ],
  dvr: [
    "DVRs são essenciais para sistemas de câmeras. Quantas câmeras você precisa conectar?",
    "Temos DVRs de 4, 8 e 16 canais. Qual a dimensão do seu projeto?"
  ],
  cabo: [
    "Cabos são importantes para a qualidade do sinal. Qual o comprimento necessário?",
    "Recomendo cabos de boa qualidade para evitar perda de sinal. Quantos metros precisa?"
  ],
  fonte: [
    "Fontes de alimentação são cruciais. Quantos equipamentos precisa alimentar?",
    "Temos fontes de diferentes potências. Qual a carga total do seu sistema?"
  ],
  padrao: [
    "Hmm, interessante! Pode me dar mais detalhes sobre o que procura?",
    "Estou aqui para ajudar! Pode ser mais específico sobre o produto?",
    "Vou te ajudar! Me diga mais sobre o que você precisa."
  ]
};

function updateSeguitoAssistant(query) {
  const messageEl = $('seguitoAssistantMessage');
  if (!messageEl) return;
  
  const normalizedQuery = normalize(query);
  let response = seguitoResponses.padrao[Math.floor(Math.random() * seguitoResponses.padrao.length)];
  
  // Verificar palavras-chave
  for (const [keyword, responses] of Object.entries(seguitoResponses)) {
    if (keyword !== 'padrao' && normalizedQuery.includes(keyword)) {
      response = responses[Math.floor(Math.random() * responses.length)];
      break;
    }
  }
  
  messageEl.textContent = response;
  messageEl.style.animation = 'none';
  setTimeout(() => messageEl.style.animation = 'fadeIn 0.3s ease', 10);
}

// Adicionar animação CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);

function manualApiHeaders(includeJson = false) {
  const headers = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  return headers;
}

async function loadServerPhotos({ silent = false } = {}) {
  if (!authToken) return;
  try {
    const response = await apiFetch('/api/photos', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Falha ao carregar fotos');
    serverPhotoIndex = data.photos || {};
    refreshVisibleProductResults();
    hydrateProductPhotos($('cartList'));
    if (pendingPhotoProduct && !$('productPhotoModal').classList.contains('hidden')) await openProductPhotoModal(pendingPhotoProduct.i, false);
  } catch (error) {
    console.error(error);
    if (!silent) showToast('Catálogo central de fotos indisponível');
  }
}

async function getProductPhotoState(code) {
  const normalizedCode = String(code);
  const server = serverPhotoIndex[normalizedCode];
  if (server?.url) return { source: 'server', url: server.url, record: server };
  const bundled = PRODUCT_PHOTO_ASSETS[normalizedCode];
  if (bundled) return { source: 'bundled', url: bundled, record: null };
  return { source: 'none', url: '', record: null };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(blob);
  });
}

async function handleProductPhotoUpload(file) {
  if (!pendingPhotoProduct || !isCurrentCoordinator()) { showToast('Acesso exclusivo de coordenadores'); return; }
  if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) { showToast('Escolha uma imagem JPG, PNG ou WEBP'); return; }
  if (file.size > 10_000_000) { showToast('A imagem deve ter no máximo 10 MB'); return; }
  showToast('Otimizando e enviando a foto ao notebook…');
  try {
    const blob = await optimizeProductPhoto(file);
    const fileDataBase64 = await blobToDataUrl(blob);
    const response = await apiFetch(`/api/photos/${encodeURIComponent(pendingPhotoProduct.code)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: `${pendingPhotoProduct.code}.webp`, fileDataBase64, description: pendingPhotoProduct.desc })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível salvar a foto');
    await loadServerPhotos({ silent: true });
    await loadPhotoAudit({ silent: true });
    await openProductPhotoModal(pendingPhotoProduct.i, false);
    showToast('Foto salva na pasta central do notebook');
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Não foi possível salvar a foto');
  } finally {
    $('photoFileInput').value = '';
    if ($('photoCameraInput')) $('photoCameraInput').value = '';
  }
}

async function removePendingProductPhoto() {
  if (!pendingPhotoProduct || !isCurrentCoordinator()) { showToast('Acesso exclusivo de coordenadores'); return; }
  if (!window.confirm('Remover todas as fotos deste produto do diretório central?')) return;
  try {
    const response = await apiFetch(`/api/photos/${encodeURIComponent(pendingPhotoProduct.code)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível remover');
    await loadServerPhotos({ silent: true });
    await loadPhotoAudit({ silent: true });
    await openProductPhotoModal(pendingPhotoProduct.i, false);
    showToast('Foto removida do diretório central');
  } catch (error) { showToast(error.message || 'Não foi possível remover a foto'); }
}

async function loadPhotoAudit({ silent = false } = {}) {
  if (!isCurrentCoordinator()) return;
  try {
    const response = await apiFetch('/api/photo-audit', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Falha no relatório');
    serverPhotoAudit = Array.isArray(data.entries) ? data.entries : [];
    renderPhotoAudit();
  } catch (error) { if (!silent) showToast(error.message || 'Relatório de fotos indisponível'); }
}

function renderPhotoPermissions() {
  const coordinator = isCurrentCoordinator();
  const badge = $('photoPermissionBadge');
  const text = $('photoPermissionText');
  if (badge) {
    badge.textContent = coordinator ? `${roleLabel(currentUser?.role)} — edição liberada` : 'Somente visualização';
    badge.classList.toggle('coordinator', coordinator);
  }
  if (text) text.textContent = coordinator
    ? `${currentUser?.name || 'Coordenador'} pode adicionar, substituir e remover fotos. Os arquivos são salvos no notebook e todas as alterações ficam registradas.`
    : 'O perfil atual pode visualizar as imagens, mas não pode adicionar, trocar, remover ou consultar o relatório de edições.';
  $('photoAuditCard')?.classList.toggle('hidden', !coordinator);
  $('photoDirectoryCard')?.classList.toggle('hidden', !coordinator);
  if (coordinator) loadPhotoAudit({ silent: true });
}

function renderPhotoAudit() {
  const list = $('photoAuditList');
  if (!list || !isCurrentCoordinator()) return;
  if (!serverPhotoAudit.length) {
    list.className = 'audit-list empty-state compact';
    list.textContent = 'Nenhuma alteração registrada no servidor.';
    return;
  }
  list.className = 'audit-list';
  list.innerHTML = serverPhotoAudit.slice(0, 100).map(entry => `<article class="audit-item"><div><span class="audit-action">${escapeHtml(entry.action)}</span><strong>Cód. ${escapeHtml(entry.code || '—')} — ${escapeHtml(entry.description || 'Foto do produto')}</strong></div><p>${escapeHtml(entry.actor || entry.coordinator || '')} · ${escapeHtml(entry.store || '')} · ${escapeHtml(localDateTime(entry.at || entry.recordedAt))}</p>${entry.details ? `<small>${escapeHtml(entry.details)}</small>` : ''}</article>`).join('');
}

function exportPhotoAudit() {
  if (!isCurrentCoordinator()) { showToast('Acesso exclusivo de coordenadores'); return; }
  if (!serverPhotoAudit.length) { showToast('Não há alterações para exportar'); return; }
  const q = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [['Ação','Código','Produto','Responsável','Loja','Data e hora','Detalhes'], ...serverPhotoAudit.map(e => [e.action,e.code,e.description,e.actor || e.coordinator,e.store,localDateTime(e.at || e.recordedAt),e.details || ''])].map(row => row.map(q).join(';'));
  downloadBlob(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `relatorio-edicao-fotos-seg-${new Date().toISOString().slice(0,10)}.csv`);
}

async function refreshPhotoDirectory() {
  if (!isCurrentCoordinator()) return;
  const button = $('refreshPhotoDirectoryBtn');
  button.disabled = true;
  button.textContent = 'Atualizando…';
  try {
    const response = await apiFetch('/api/photos/refresh', { method: 'POST' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Falha ao atualizar');
    serverPhotoIndex = data.photos || {};
    const d = data.diff || {};
    $('photoDirectoryStatus').textContent = `${d.total || 0} produtos com foto. Novas: ${(d.added || []).length}; alteradas: ${(d.changed || []).length}; removidas: ${(d.removed || []).length}.`;
    refreshVisibleProductResults();
    await loadPhotoAudit({ silent: true });
    showToast('Catálogo de fotos atualizado');
  } catch (error) { showToast(error.message || 'Não foi possível atualizar a pasta'); }
  finally { button.disabled = false; button.textContent = 'Atualizar catálogo'; }
}

function renderManualPermissions() {
  const coordinator = isCurrentCoordinator();
  $('manageManualsBtn')?.classList.toggle('hidden', !coordinator);
  $('manualAuditCard')?.classList.toggle('hidden', !coordinator);
  if (coordinator) loadManualAudit({ silent: true });
}

function openClientSearch() {
  if (!['seller', 'coordinator', 'admin'].includes(currentUser?.role || '')) { showToast('Pesquisa exclusiva para funcionários'); return; }
  $('clientSearchModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  $('clientSearchInput').value = '';
  $('clientSearchResults').className = 'client-search-results empty-state compact';
  $('clientSearchResults').textContent = 'Digite para pesquisar.';
  setTimeout(() => $('clientSearchInput').focus(), 60);
}

function clientMeta(client) {
  return [client.code ? `Cód. ${client.code}` : '', client.document, client.phone || client.whatsapp, [client.city, client.state].filter(Boolean).join(' / ')].filter(Boolean).join(' · ');
}

async function searchClientsNow() {
  const query = $('clientSearchInput').value.trim();
  $('clientSearchClear').classList.toggle('hidden', !query);
  const results = $('clientSearchResults');
  if (normalize(query).length < 2) {
    results.className = 'client-search-results empty-state compact';
    results.textContent = 'Digite pelo menos 2 caracteres.';
    return;
  }
  results.className = 'client-search-results empty-state compact';
  results.textContent = 'Pesquisando…';
  try {
    const response = await apiFetch(`/api/clients?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Falha na pesquisa');
    const clients = data.clients || [];
    if (!clients.length) {
      results.className = 'client-search-results empty-state compact';
      results.textContent = 'Nenhum cliente encontrado. Confirme se o CSV já foi importado.';
      return;
    }
    results.className = 'client-search-results';
    results.innerHTML = clients.map((client, index) => `<button class="client-result" data-client-index="${index}" type="button"><div><strong>${escapeHtml(client.name)}</strong>${client.fantasyName ? `<span>${escapeHtml(client.fantasyName)}</span>` : ''}<span>${escapeHtml(clientMeta(client))}</span></div><b>Selecionar</b></button>`).join('');
    results.querySelectorAll('[data-client-index]').forEach(button => button.addEventListener('click', () => selectClient(clients[Number(button.dataset.clientIndex)])));
  } catch (error) {
    results.className = 'client-search-results empty-state compact';
    results.textContent = error.message || 'Não foi possível pesquisar clientes.';
  }
}

function selectClient(client) {
  $('clientName').value = client.name || client.fantasyName || '';
  $('clientCode').value = client.code || '';
  $('clientDocument').value = client.document || '';
  $('clientPhone').value = client.whatsapp || client.phone || '';
  $('clientIE').value = client.ie || '';
  const location = [client.address, client.neighborhood ? `Bairro ${client.neighborhood}` : '', client.cep ? `CEP ${client.cep}` : ''].filter(Boolean).join(' — ');
  $('clientAddress').value = location;
  $('clientCity').value = client.city || 'RIO DE JANEIRO';
  $('clientState').value = client.state || 'RJ';
  closeModal('clientSearchModal');
  refreshQuoteGuideState();
  showToast(`Cliente ${client.name} selecionado`);
}

async function importClientsCsv() {
  if (!pendingClientCsv || !isCurrentCoordinator()) return;
  const button = $('importClientsBtn');
  button.disabled = true;
  button.textContent = 'Importando…';
  try {
    const fileDataBase64 = await blobToDataUrl(pendingClientCsv);
    const response = await apiFetch('/api/clients/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: pendingClientCsv.name, fileDataBase64 })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível importar');
    $('clientImportStatus').textContent = `${data.count.toLocaleString('pt-BR')} clientes importados com sucesso. ${data.preservedBlocks ? `${data.preservedBlocks.toLocaleString('pt-BR')} bloqueio(s) preservado(s). ` : ''}Delimitador detectado: “${data.metadata?.delimiter || ';'}”.`;
    pendingClientCsv = null;
    $('clientCsvInput').value = '';
    await loadClientImportAudit({ silent: true });
    showToast('Base de clientes atualizada');
  } catch (error) {
    $('clientImportStatus').textContent = error.message || 'Falha na importação.';
    showToast(error.message || 'Não foi possível importar clientes');
  } finally {
    button.textContent = 'Importar clientes';
    button.disabled = !pendingClientCsv;
  }
}

async function loadClientImportAudit({ silent = false } = {}) {
  if (!isCurrentCoordinator()) return;
  try {
    const response = await apiFetch('/api/client-import-audit', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Falha no histórico');
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const list = $('clientImportAudit');
    if (!entries.length) {
      list.className = 'audit-list empty-state compact';
      list.textContent = 'Nenhuma importação registrada.';
    } else {
      list.className = 'audit-list';
      list.innerHTML = entries.slice(0, 15).map(e => `<article class="audit-item"><div><span class="audit-action">CSV</span><strong>${Number(e.count || 0).toLocaleString('pt-BR')} clientes — ${escapeHtml(e.fileName || '')}</strong></div><p>${escapeHtml(e.actor || '')} · ${escapeHtml(e.store || '')} · ${escapeHtml(localDateTime(e.at))}</p></article>`).join('');
    }
  } catch (error) { if (!silent) showToast(error.message || 'Histórico indisponível'); }
}

function updateSeguitoTip() {
  if (!currentUser) return;
  const page = document.querySelector('.page.active')?.id.replace('page-', '') || 'products';
  const tips = {
    quote: 'Posso ajudar a pesquisar produtos, selecionar um cliente e conferir o orçamento antes do envio.',
    products: isCurrentCoordinator() ? 'Toque na câmera para editar uma foto. Você também pode copiar imagens direto para a pasta central.' : 'Pesquise por código ou descrição. Toque na foto para ampliar.',
    assistant: 'Pergunte pelo código, modelo ou descrição. Nesta fase eu consulto o catálogo local.',
    support: 'Comece pelo SEG Ajuda. Quando não houver resposta, consulte o fabricante ou publique no fórum.',
    history: 'Seus pedidos ficam preservados no sistema. Use Reutilizar para criar uma nova cópia ou transforme um pedido em modelo.',
    settings: 'Coordenadores podem atualizar fotos, manuais e importar a base de clientes em CSV.'
  };
  $('seguitoTipText').textContent = tips[page] || 'Como posso ajudar?';
}

function switchPage(page) {
  if (currentUser && !permittedPagesForRole(currentUser.role).includes(page)) return;
  document.querySelectorAll('.page').forEach(section => section.classList.toggle('active', section.id === `page-${page}`));
  document.querySelectorAll('.nav-btn').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  if (page === 'quote') showQuoteStep(currentQuoteStep, { scroll: false, focus: false });
  if (page === 'history') {
    renderHistory();
    syncQuoteHistoryWithServer({ silent: true });
  }
  if (page === 'support') {
    renderManuals(false); renderForum(); updateOfficialSourceHint();
    if (!serverManuals.length) loadServerManuals({ silent: true });
  }
  if (page === 'settings') {
    renderPhotoPermissions(); renderManualPermissions();
    if (isCurrentCoordinator()) loadClientImportAudit({ silent: true });
    if (currentUser?.role === 'admin') {
      loadAccessRequests();
      loadPasswordResetRequests();
    }
  }
  updateSeguitoTip();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindV52Events() {
  $('loginForm').addEventListener('submit', submitLogin);
  ['loginUsername', 'loginPassword'].forEach(id => $(id).addEventListener('input', () => {
    const filled = $('loginUsername').value.trim() && $('loginPassword').value;
    setSeguitoLoginState(filled ? 'attentive' : 'serious', filled ? 'Estou prestando atenção…' : 'Digite seu código ou usuário e sua senha.');
    $('loginError').classList.add('hidden');
  }));
  $('toggleLoginPassword').addEventListener('click', () => {
    const input = $('loginPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
    $('toggleLoginPassword').textContent = input.type === 'password' ? '◉' : '◎';
  });
  $('openRegisterBtn').addEventListener('click', openRegisterModal);
  $('registerForm').addEventListener('submit', submitRegistration);
  $('registerEmail').addEventListener('input', () => {
    if (!$('registerUsername').dataset.edited) $('registerUsername').value = normalize($('registerEmail').value).replace(/\s+/g, '');
  });
  $('registerUsername').addEventListener('input', () => { $('registerUsername').dataset.edited = '1'; });
  $('refreshAccessRequestsBtn')?.addEventListener('click', () => loadAccessRequests());
  $('refreshPasswordResetRequestsBtn')?.addEventListener('click', () => loadPasswordResetRequests());
  $('logoutBtn').addEventListener('click', logout);
  $('homeLogoutBtn').addEventListener('click', logout);
  $('homeBtn').addEventListener('click', showHomeScreen);
  $('changePasswordBtn').addEventListener('click', openChangePasswordModal);
  $('changePasswordForm').addEventListener('submit', submitPasswordChange);
  document.querySelectorAll('[data-close-modal="changePasswordModal"]').forEach(el => el.addEventListener('click', () => closeModal('changePasswordModal')));

  document.querySelectorAll('.quick-access-btn').forEach(btn => {
    btn.addEventListener('click', event => {
      event.preventDefault();
      handleQuickAccess(btn.dataset.action);
    });
  });

  $('refreshPhotoDirectoryBtn').addEventListener('click', refreshPhotoDirectory);
  $('searchClientBtn').addEventListener('click', openClientSearch);
  $('clientSearchInput').addEventListener('input', () => {
    clearTimeout(clientSearchTimer);
    clientSearchTimer = setTimeout(searchClientsNow, 280);
  });
  $('clientSearchClear').addEventListener('click', () => { $('clientSearchInput').value = ''; searchClientsNow(); $('clientSearchInput').focus(); });
  $('clientCsvInput').addEventListener('change', event => {
    pendingClientCsv = event.target.files?.[0] || null;
    $('importClientsBtn').disabled = !pendingClientCsv;
    $('clientImportStatus').textContent = pendingClientCsv ? `Arquivo selecionado: ${pendingClientCsv.name} (${(pendingClientCsv.size / 1024).toFixed(0)} KB).` : 'Nenhum arquivo selecionado.';
  });
  $('importClientsBtn').addEventListener('click', importClientsCsv);
  $('seguitoDockButton').addEventListener('click', () => { updateSeguitoTip(); $('seguitoTip').classList.toggle('hidden'); });
  $('closeSeguitoTip').addEventListener('click', () => $('seguitoTip').classList.add('hidden'));
  document.querySelectorAll('[data-close-modal="clientSearchModal"]').forEach(el => el.addEventListener('click', () => closeModal('clientSearchModal')));
}

function productCard(product, mode = 'quote') {
  const clientMode = currentUser?.role === 'client';
  const contactButton = mode === 'catalog'
    ? `<button class="sales-contact-btn" data-sales-product-index="${product.i}" type="button">Falar com vendedor</button>`
    : '';
  const addButton = clientMode ? '' : `<button class="add-product-btn" data-product-index="${product.i}" type="button">${mode === 'catalog' ? 'Adicionar' : '+'}</button>`;
  return `<article class="product-row product-row-with-photo">
    ${productMediaHtml(product)}
    <div class="product-copy"><span class="product-code">CÓD. ${escapeHtml(product.code)}</span><div class="product-desc">${escapeHtml(product.desc)}</div><div class="product-price">${money.format(product.price)}</div></div>
    <div class="product-actions">${addButton}${contactButton}</div>
  </article>`;
}

function assistantReply(query) {
  const found = searchProducts(query, 5);
  const normalized = normalize(query);
  const clientMode = currentUser?.role === 'client';
  const productIntro = /preco|valor|quanto|custa/.test(normalized)
    ? 'Encontrei estes preços de venda no catálogo atual:'
    : 'Encontrei estes produtos relacionados:';
  const productSection = found.length
    ? `<div class="chat-section">${productIntro}${found.map(p => `<div class="chat-product"><strong>${escapeHtml(p.code)}</strong><br>${escapeHtml(p.desc)}<br><strong>${money.format(p.price)}</strong><br>${clientMode ? '' : `<button type="button" data-chat-product="${p.i}">Adicionar ao orçamento</button>`}<button class="chat-sales-btn" type="button" data-chat-sales="${p.i}">Falar com vendedor</button></div>`).join('')}</div>`
    : '<div class="chat-section">Não encontrei produtos com esse termo no catálogo.</div>';
  const manualSection = searchManualsForAssistant(query);
  const forumSection = searchForumForAssistant(query);
  const supportTip = (manualSection || forumSection)
    ? '<div class="chat-section muted">Se precisar de mais detalhes, use a aba <strong>Manuais e comunidade</strong> ou fale com a SEG.</div>'
    : '<div class="chat-section muted">Não encontrei produtos, manuais nem dúvidas relacionadas. Tente reformular ou use a aba <strong>Manuais e comunidade</strong>.</div>';
  return `${productSection}${manualSection}${forumSection}${supportTip}`;
}

async function clearLegacyOfflineCache() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations
        .filter(registration => !/\/sw\.js(?:\?|$)/i.test(registration.active?.scriptURL || registration.installing?.scriptURL || registration.waiting?.scriptURL || ''))
        .map(registration => registration.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith('seg-vendas-')).map(key => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('./sw.js?v=5.9.14', { scope: './' });
    }
  } catch (error) {
    console.warn('Não foi possível limpar todo o cache antigo:', error);
  }
}

async function init() {
  await clearLegacyOfflineCache();
  document.body.classList.add('auth-locked');
  initSelect('storeSelect', STORES);
  const initialStore = STORES.includes(currentQuote.store) ? currentQuote.store : STORES[0];
  $('storeSelect').value = initialStore;
  currentQuote.store = initialStore;
  currentQuote.seller = populateSellerSelect(initialStore, currentQuote.seller);
  currentQuote.sellerRole = sellerProfile(currentQuote.store, currentQuote.seller)?.role || 'seller';
  const settings = getSettings();
  $('companySite').value = settings.site;
  $('companyPhones').value = settings.phones;
  $('productCountLabel').textContent = `${productIndex.length.toLocaleString('pt-BR')} itens`;
  updateLogoControls();
  applyBranding();
  $('forumAuthorName').value = localStorage.getItem('seg_forum_last_name') || '';
  const rememberedForumRole = localStorage.getItem('seg_forum_last_role');
  $('forumAuthorRole').value = sanitizeForumRole(rememberedForumRole, forumDefaultRole());
  bindEvents();
  bindV52Events();
  populateQuoteForm();
  renderHistory();
  updateConnection();
  await restoreSession();
}

init();
