// fix-cta-card.mjs
// Corrige la CTA card de la sidebar en app/[slug]/StaticPageClient.tsx:
//   1) Textos de Rome -> Las Vegas
//   2) Fallback /tours/colosseum -> /tours (card + boton flotante mobile)
//   3) Mueve el boton "View Tours" para que quede DEBAJO de la imagen
//
// Uso:
//   node fix-cta-card.mjs --dry-run   (muestra que cambiaria, NO escribe)
//   node fix-cta-card.mjs             (aplica)
//
// Idempotente y CRLF-aware. Solo toca este archivo.

import fs from 'fs';

const DRY = process.argv.includes('--dry-run');
const FILE = 'app/[slug]/StaticPageClient.tsx';

const PAIRS = [
  // ---- 1) textos Rome -> Las Vegas ----
  ["'Ready to Explore Rome?'",
   "'Ready to Explore Las Vegas?'"],
  ["'Start Your Roman Adventure'",
   "'Start Your Vegas Adventure'"],
  ["'Discover the best tours and experiences in the Eternal City.'",
   "'Discover the best tours, shows, and day trips in Las Vegas.'"],
  ["'Explore our amazing tours and experiences in Rome.'",
   "'Explore our amazing tours, shows, and day trips in Las Vegas.'"],

  // ---- 2 + 3) SACAR el boton de arriba (queda solo titulo + parrafo) ----
  // El bloque incluye el fallback viejo /tours/colosseum de la card sidebar.
  [
`                </p>
                
                <a 
                  href={page.pageSettings?.ctaUrl || '/tours/colosseum'}
                  target={page.pageSettings?.ctaUrl?.startsWith('http') ? '_blank' : '_self'}
                  rel={page.pageSettings?.ctaUrl?.startsWith('http') ? 'noopener noreferrer' : undefined}
                  style={{
                    display: 'block',
                    background: '#e91e63',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '25px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  {page.pageSettings?.ctaText || 'View Tours'}
                </a>
              </div>`,
`                </p>
              </div>`
  ],

  // ---- 3) INSERTAR el boton DESPUES de la imagen (antes de los iconos) ----
  [
`                  </div>
                </div>
              )}

              {/* ICONOS/FEATURES */}`,
`                  </div>
                </div>
              )}

              {/* CTA BUTTON - debajo de la imagen */}
              <div style={{ padding: '0 20px 25px 20px' }}>
                <a 
                  href={page.pageSettings?.ctaUrl || '/tours'}
                  target={page.pageSettings?.ctaUrl?.startsWith('http') ? '_blank' : '_self'}
                  rel={page.pageSettings?.ctaUrl?.startsWith('http') ? 'noopener noreferrer' : undefined}
                  style={{
                    display: 'block',
                    background: '#e91e63',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '25px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  {page.pageSettings?.ctaText || 'View Tours'}
                </a>
              </div>

              {/* ICONOS/FEATURES */}`
  ],

  // ---- 2) boton flotante mobile: fallback /tours/colosseum -> /tours ----
  ["href={page.pageSettings?.ctaUrl || '/tours/colosseum'}",
   "href={page.pageSettings?.ctaUrl || '/tours'}"],
];

let content;
try { content = fs.readFileSync(FILE, 'utf8'); }
catch { console.log(`ERROR: no existe ${FILE}`); process.exit(1); }

const nl = content.includes('\r\n') ? '\r\n' : '\n';
const conv = (s) => s.split('\n').join(nl);

let changed = 0;
const missing = [];
for (const [fromRaw, toRaw] of PAIRS) {
  const from = conv(fromRaw), to = conv(toRaw);
  if (content.includes(from)) {
    const n = content.split(from).length - 1;
    content = content.split(from).join(to);
    changed += n;
  } else {
    missing.push(fromRaw.slice(0, 55).replace(/\n/g, ' '));
  }
}

if (!DRY && changed > 0) fs.writeFileSync(FILE, content);

console.log(`${FILE}: ${changed} reemplazo(s)${missing.length ? ` - ${missing.length} no encontrado(s)` : ''}`);
missing.forEach((m) => console.log(`     · no encontrado (¿ya corregido?): ${m}...`));
console.log(`\n${DRY ? '[DRY-RUN] ' : ''}Total: ${changed} reemplazos${DRY ? ' (no se escribió nada)' : ''}`);
