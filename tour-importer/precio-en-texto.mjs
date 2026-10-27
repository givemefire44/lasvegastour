// precio-en-texto.mjs — reemplazo del precio de un tour dentro de un texto.
// Lo usan cron-prices.mjs (cada vez que cambia el precio) y backfill-precio-seodescription.mjs.
//
// Tres cosas que el reemplazo anterior hacia mal, y por que:
//   1. Cierre `(?![\d])`: dejaba pasar el punto, y con oldP=45 convertia un `$45.90` ajeno en `$63.90`.
//      Ahora `(?!\d)(?![.,]\d)`: no sigue un digito, ni un punto/coma seguido de digito.
//      Un punto final de oracion ("cuesta $45.") si se reemplaza.
//   2. `reOld.test()` con flag g guarda lastIndex entre llamadas y salteaba coincidencias en el
//      span siguiente. Aca no hay test(): se reemplaza y se compara.
//   3. Solo buscaba el precio exacto (925.68), y los textos lo citan redondeado ($926).
//      Si el precio viejo tiene decimales, tambien se busca el redondeado, y se escribe redondeado.
//
// El reemplazo es siempre con funcion: un string de reemplazo interpretaria `$$` y `$1`.

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Como se escribe un precio en prosa: entero tal cual, con decimales a 2 (122.5 -> 122.50).
export function formatPrice(p) {
  const n = Number(p);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// Variantes con que un precio puede aparecer en un texto ya escrito.
function variantes(p) {
  const n = Number(p);
  const out = new Set([formatPrice(n), String(n)]);
  if (Number.isInteger(n)) out.add(n.toFixed(2));               // 230 -> 230.00
  for (const v of [...out]) {                                   // 1230 -> 1,230
    const [ent, dec] = v.split('.');
    if (ent.length > 3) out.add(ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? '.' + dec : ''));
  }
  return [...out];
}

/**
 * Reemplaza oldP por newP en un texto. Devuelve { text, changes }.
 * - Montos exactos (925.68, 230, 230.00, 1,230) -> newP con formatPrice.
 * - Si oldP tiene decimales, su redondeo ($926) -> newP redondeado ($931).
 * Solo reconoce montos precedidos por "$" o "USD ".
 */
export function replacePriceInText(text, oldP, newP) {
  if (typeof text !== 'string' || !text) return { text, changes: 0 };
  const old = Number(oldP), nw = Number(newP);
  const exactas = variantes(old);
  const redondeado = Number.isInteger(old) ? null : String(Math.round(old));
  const alternativas = [...exactas, ...(redondeado && !exactas.includes(redondeado) ? [redondeado] : [])]
    .sort((a, b) => b.length - a.length)                        // la mas larga primero: 925.68 antes que 925
    .map(esc);
  const re = new RegExp('(\\$|USD )(' + alternativas.join('|') + ')(?!\\d)(?![.,]\\d)', 'g');
  let changes = 0;
  const conComa = (s) => s.replace(/^\d+/, (ent) => ent.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  const out = text.replace(re, (m, pre, monto) => {
    changes++;
    const nuevo = monto === redondeado ? String(Math.round(nw)) : formatPrice(nw);
    return pre + (monto.includes(',') ? conComa(nuevo) : nuevo);         // respeta "1,230" si asi estaba
  });
  return { text: out, changes };
}

// Lo mismo sobre un body de Portable Text, span por span, preservando marks.
export function replacePriceInBlocks(body, oldP, newP) {
  let changes = 0;
  const nb = (body || []).map((b) => {
    if (!b.children) return b;
    return { ...b, children: b.children.map((c) => {
      if (typeof c.text !== 'string') return c;
      const r = replacePriceInText(c.text, oldP, newP);
      changes += r.changes;
      return r.changes ? { ...c, text: r.text } : c;
    }) };
  });
  return { body: nb, changes };
}
