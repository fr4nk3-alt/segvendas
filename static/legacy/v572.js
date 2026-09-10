'use strict';

(() => {
  const inputs = Array.from(document.querySelectorAll('.visual-search-input'));
  if (!inputs.length) return;

  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const MAX_SOURCE_PIXELS = 30_000_000;
  const MAX_CANVAS_PIXELS = 3_200_000;
  const MAX_CANVAS_SIDE = 1900;
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
  const zxingApi = window.ZXingBrowser || (typeof globalThis !== 'undefined' ? globalThis.ZXingBrowser : null);
  if (zxingApi && !window.ZXingBrowser) window.ZXingBrowser = zxingApi;
  document.documentElement.dataset.visualReader = zxingApi?.BrowserMultiFormatReader ? 'ready' : 'missing';
  let reading = false;

  function setStatus(status, message, kind = '') {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', kind === 'error');
    status.classList.toggle('is-success', kind === 'success');
  }

  function validateFile(file) {
    if (!file) throw new Error('Nenhuma imagem foi selecionada.');
    if (file.size > MAX_FILE_BYTES) throw new Error('A imagem deve ter no máximo 15 MB.');
    const type = String(file.type || '').toLowerCase();
    const validExtension = /\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name || '');
    if ((type && !allowedTypes.has(type)) || (!type && !validExtension)) {
      throw new Error('Use uma foto JPG, PNG, WebP, HEIC ou HEIF.');
    }
  }

  function loadLocalImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve({ image, url });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Este formato de imagem não pôde ser aberto pelo navegador.'));
      };
      image.src = url;
    });
  }

  function imageCanvas(image) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) throw new Error('A imagem selecionada está vazia.');
    if (sourceWidth * sourceHeight > MAX_SOURCE_PIXELS) throw new Error('A foto é grande demais. Use uma imagem de até 30 megapixels.');

    const sideScale = Math.min(1, MAX_CANVAS_SIDE / Math.max(sourceWidth, sourceHeight));
    const pixelScale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (sourceWidth * sourceHeight)));
    const scale = Math.min(sideScale, pixelScale);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!context) throw new Error('O navegador não conseguiu preparar a imagem.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function decodeWithNativeApi(canvas) {
    if (!('BarcodeDetector' in window)) return [];
    try {
      const wanted = ['aztec', 'code_128', 'code_39', 'code_93', 'codabar', 'data_matrix', 'ean_13', 'ean_8', 'itf', 'pdf417', 'qr_code', 'upc_a', 'upc_e'];
      const supported = typeof BarcodeDetector.getSupportedFormats === 'function' ? await BarcodeDetector.getSupportedFormats() : [];
      const formats = supported.length ? wanted.filter(format => supported.includes(format)) : [];
      const detector = formats.length ? new BarcodeDetector({ formats }) : new BarcodeDetector();
      const found = await detector.detect(canvas);
      return found.map(result => String(result?.rawValue || '')).filter(Boolean);
    } catch { return []; }
  }

  function decodeWithZxing(canvas) {
    try {
      const Reader = zxingApi?.BrowserMultiFormatReader;
      if (!Reader) return [];
      const result = new Reader().decodeFromCanvas(canvas);
      const value = String(result?.getText?.() || result?.text || '');
      return value ? [value] : [];
    } catch { return []; }
  }

  function safeProductQuery(decodedValue) {
    const text = String(decodedValue || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 160);
    if (!text) return '';

    if (/^https?:\/\//i.test(text)) {
      try {
        const parsed = new URL(text);
        for (const name of ['codigo', 'code', 'sku', 'produto', 'product']) {
          const value = parsed.searchParams.get(name);
          if (value && /^[a-z0-9._-]{3,30}$/i.test(value)) return value.slice(0, 30);
        }
      } catch { /* nunca abrir o link encontrado */ }
      return '';
    }

    const labeled = text.match(/(?:c[oó]digo|cod|sku)\s*[:#-]?\s*([a-z0-9._-]{3,30})/i);
    if (labeled) return labeled[1];
    if (/^[a-z0-9._-]{3,30}$/i.test(text)) return text;
    const embedded = text.match(/\b(?:[a-z]{1,4}[-_.]?)?\d{3,14}\b/i);
    return embedded?.[0] || '';
  }

  function exactProductExists(query) {
    try {
      const q = String(query || '').toLowerCase();
      if (!q) return false;
      const eanMap = typeof EAN_MAP !== 'undefined' ? EAN_MAP : {};
      if (eanMap[q]) return true;
      return typeof productIndex !== 'undefined' && Array.isArray(productIndex)
        && productIndex.some(product => String(product?.code || '').toLowerCase() === q);
    } catch { return false; }
  }

  function bestProductQuery(decodedValues) {
    const queries = Array.from(new Set(decodedValues.map(safeProductQuery).filter(Boolean)));
    const eanMap = typeof EAN_MAP !== 'undefined' ? EAN_MAP : {};
    for (const query of queries) {
      if (eanMap[query]) return String(eanMap[query]);
    }
    return queries.find(exactProductExists) || queries[0] || '';
  }

  async function readSearchImage(input) {
    const file = input.files?.[0];
    const status = document.getElementById(input.dataset.searchStatus || '');
    const target = document.getElementById(input.dataset.searchTarget || '');
    const tools = input.closest('.visual-search-tools');
    let canvas = null;
    let localImage = null;

    if (reading) { setStatus(status, 'Aguarde a leitura atual terminar.', 'error'); input.value = ''; return; }
    reading = true;
    tools?.classList.add('is-reading');
    setStatus(status, 'Lendo o código da imagem…');

    try {
      validateFile(file);
      if (!('BarcodeDetector' in window) && !zxingApi?.BrowserMultiFormatReader) {
        throw new Error('O leitor de códigos não está disponível. Feche e abra o aplicativo novamente.');
      }
      localImage = await loadLocalImage(file);
      canvas = imageCanvas(localImage.image);
      const decodedValues = await decodeWithNativeApi(canvas);
      if (!decodedValues.length) decodedValues.push(...decodeWithZxing(canvas));
      const query = bestProductQuery(decodedValues);
      if (!query) {
        if (decodedValues.some(value => /^https?:\/\//i.test(value))) throw new Error('O QR contém um link, não um código de produto pesquisável.');
        throw new Error('Não encontrei um código nítido. Aproxime a câmera e tente novamente.');
      }
      if (!target) throw new Error('O campo de pesquisa não está disponível.');

      target.value = query;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setStatus(status, exactProductExists(query)
        ? `Produto ${query} identificado. Pesquisando…`
        : `Código ${query} lido. Confira os resultados da pesquisa.`, 'success');
      try { if (typeof showToast === 'function') showToast(`Código ${query} lido pela imagem`); } catch { /* compatibilidade */ }
    } catch (error) {
      setStatus(status, error?.message || 'Não foi possível ler esta imagem.', 'error');
    } finally {
      if (localImage?.url) URL.revokeObjectURL(localImage.url);
      if (canvas) { canvas.width = 1; canvas.height = 1; }
      input.value = '';
      reading = false;
      tools?.classList.remove('is-reading');
    }
  }

  inputs.forEach(input => input.addEventListener('change', () => readSearchImage(input)));
})();
