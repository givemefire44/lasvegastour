
// factsheet-source.js - Fuente de HECHOS para un tour, usada por todos los injectors.
// Prioriza el CORPUS (origen Viator) via buildFactSheet; si el producto aun no esta
// en el corpus, cae al texto derivado del body. Un solo lugar para mantener.

import { getProduct, buildFactSheet } from './corpus.js';

const codeFromUrl = url => (String(url || '').match(/d\d+-([0-9A-Za-z]+)/) || [])[1] || null;

// --- Fallback: texto de hechos derivado del body (excluye secciones de opinion) ---
const isHeading = b => b && b._type === 'block' && ['h1', 'h2', 'h3', 'h4'].includes(b.style);
const headingText = b => (b.children || []).map(c => c.text || '').join('');
const blockText = b => (b.children || []).map(c => c.text || '').join('');
const EXCLUDE = ['quick answer', 'why people book this', 'is it worth it'];
function bodyToText(body) {
  const lines = [];
  let skipping = false;
  for (const b of (body || [])) {
    if (isHeading(b)) {
      const t = headingText(b).toLowerCase();
      skipping = EXCLUDE.some(p => t.includes(p));
      if (!skipping) lines.push('## ' + headingText(b).replace(/^[^\w]+/, '').trim());
      continue;
    }
    if (skipping) continue;
    const t = blockText(b).trim();
    if (t) lines.push((b.listItem === 'bullet' ? '- ' : '') + t);
  }
  return lines.join('\n');
}

// Devuelve { text, origin: 'corpus'|'body', code }. El injector reporta `origin` en su preview.
export function sourceForTour(tour) {
  const code = codeFromUrl(tour?.getYourGuideUrl);
  if (code) {
    try {
      const p = getProduct(code);
      if (p) return { text: buildFactSheet(p), origin: 'corpus', code };
    } catch { /* corpus no disponible -> fallback */ }
  }
  return { text: bodyToText(tour?.body || []), origin: 'body', code };
}

export { codeFromUrl };