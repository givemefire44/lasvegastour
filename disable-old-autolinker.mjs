// disable-old-autolinker.mjs
// Apaga el autolinker VIEJO (UnifiedAutoLinker) en los 3 componentes que lo usan,
// poniendo disabled={true}. NO toca imports ni los links nuevos (persistidos en Sanity).
//
// Uso:
//   node disable-old-autolinker.mjs --dry-run   (muestra qué cambiaría, NO escribe)
//   node disable-old-autolinker.mjs             (aplica)
//
// Va en la RAÍZ del proyecto (donde está la carpeta app). Idempotente y CRLF-aware.

import fs from 'fs';

const DRY = process.argv.includes('--dry-run');

const FIXES = [
  {
    file: 'app/components/blog/SanityContent.tsx',
    pairs: [
      ['<UnifiedAutoLinker pageSlug={tourSlug} pageType="tour" as="div" className="content-paragraph">',
       '<UnifiedAutoLinker pageSlug={tourSlug} pageType="tour" as="div" className="content-paragraph" disabled={true}>'],
    ],
  },
  {
    file: 'app/components/HubPage.tsx',
    pairs: [
      // los 5 usos comparten este prefijo
      ['<UnifiedAutoLinker pageSlug={hub.slug} pageType="hub" style=',
       '<UnifiedAutoLinker disabled={true} pageSlug={hub.slug} pageType="hub" style='],
    ],
  },
  {
    file: 'app/[slug]/StaticPageClient.tsx',
    pairs: [
      // los 2 usos ya tenían disabled={isExcludedPage}; lo forzamos a true
      ['disabled={isExcludedPage}',
       'disabled={true}'],
    ],
  },
];

let total = 0;
for (const { file, pairs } of FIXES) {
  let content;
  try { content = fs.readFileSync(file, 'utf8'); }
  catch { console.log(`SKIP (no existe): ${file}`); continue; }

  const nl = content.includes('\r\n') ? '\r\n' : '\n';
  const conv = (s) => s.split('\n').join(nl);

  let changed = 0;
  const missing = [];
  for (const [fromRaw, toRaw] of pairs) {
    const from = conv(fromRaw), to = conv(toRaw);
    if (content.includes(from)) {
      const n = content.split(from).length - 1;
      content = content.split(from).join(to);
      changed += n;
    } else {
      missing.push(fromRaw.slice(0, 55));
    }
  }
  if (!DRY && changed > 0) fs.writeFileSync(file, content);
  total += changed;
  console.log(`${file}: ${changed} cambio(s)${missing.length ? ` - ${missing.length} no encontrado(s)` : ''}`);
  missing.forEach(m => console.log(`     · no encontrado (¿ya desactivado?): ${m}...`));
}

console.log(`\n${DRY ? '[DRY-RUN] ' : ''}Total: ${total} cambios${DRY ? ' (no se escribió nada)' : ''}`);
