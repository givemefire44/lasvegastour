// fix-schema-resabios.mjs
// Corrige SOLO los resabios de Colosseum/Rome en los archivos que generan schema.
// NO toca: nombres de campo (getYourGuideData/Url/TourId) ni el bloque research.
//
// Uso:
//   node fix-schema-resabios.mjs --dry-run   (muestra que cambiaria, NO escribe)
//   node fix-schema-resabios.mjs             (aplica)
//
// Idempotente: si un resabio ya esta corregido, lo reporta como "no encontrado" y sigue.
// Maneja CRLF: adapta los saltos de linea al line-ending de cada archivo.

import fs from 'fs';

const DRY = process.argv.includes('--dry-run');

const FIXES = [
  {
    file: 'app/components/AuthorBox.tsx',
    pairs: [
      ["role: 'Founder & Rome Expert',",
       "role: 'Founder of Intercoper',"],
      ['bio: "I\'ve spent years researching Rome\'s history and the Colosseum. I created LasVegasTour to help travelers experience the real Rome, not just the tourist surface.",',
       'bio: "I\'ve spent years building independent travel guides through Intercoper. I created LasVegasTour to help travelers find the best tours, shows, and day trips in Las Vegas - reviewed and compared, not just the tourist surface.",'],
    ],
  },
  {
    file: 'app/page.tsx',
    pairs: [
      ["'Rome Tours & Experiences | LasVegasTour'",
       "'Las Vegas Tours, Shows & Day Trips | LasVegasTour'"],
      ["'Discover authentic Rome with skip-the-line tours, expert guides, and unforgettable experiences. Book your perfect Roman adventure today.'",
       "'Discover the best of Las Vegas with top-rated tours, shows, and day trips to the Grand Canyon and Hoover Dam. Book your perfect Vegas experience today.'"],
      ["['Rome tours', 'Colosseum tours', 'Vatican tours', 'skip the line', 'Rome experiences']",
       "['Las Vegas tours', 'Grand Canyon tours', 'Hoover Dam tours', 'Las Vegas shows', 'things to do in Las Vegas']"],
      ['"description": "Expert curators of the best Colosseum tours and comprehensive Rome travel guides since 2006.",',
       '"description": "Expert curators of the best Las Vegas tours, shows, and day trips since 2006.",'],
      ['"jobTitle": "Founder & Rome Travel Curator",',
       '"jobTitle": "Founder of Intercoper",'],
      ['"description": "Your expert guide to Colosseum tours and Rome travel planning",',
       '"description": "Your expert guide to Las Vegas tours, shows, and day trips",'],
      ['"name": "Featured Colosseum Tours",',
       '"name": "Featured Las Vegas Tours",'],
      ['"description": "Top-rated Colosseum tours handpicked by our experts",',
       '"description": "Top-rated Las Vegas tours handpicked by our experts",'],
      // "Colosseum Roman" (org, website, publisher) - todas a LasVegasTour
      ['"name": "Colosseum Roman",',
       '"name": "LasVegasTour",'],
    ],
  },
  {
    file: 'app/utils/schemaGenerator.ts',
    pairs: [
      ["jobTitle: 'Founder & Rome Expert',",
       "jobTitle: 'Founder of Intercoper',"],
      ["jobTitle: 'Founder & Rome Travel Curator',",
       "jobTitle: 'Founder of Intercoper',"],
      ["name: 'Colosseum Roman',",
       "name: 'LasVegasTour',"],
      ["description: 'Expert curators of the best Colosseum tours and comprehensive Rome travel guides. Independent affiliate partner of GetYourGuide and Viator.',",
       "description: 'Expert curators of the best Las Vegas tours, shows, and day trips. Independent affiliate partner of Viator.',"],
      ["name: 'Rome, Italy'",
       "name: 'Las Vegas, Nevada'"],
      // founder knowsAbout (lista corta)
      ["          knowsAbout: [\n            'Roman Colosseum',\n            'Rome Tourism',\n            'Historical Tours',\n            'Travel Planning'\n          ],",
       "          knowsAbout: [\n            'Travel Content Curation',\n            'Digital Travel Guides',\n            'Tour Affiliate Publishing',\n            'Travel Planning'\n          ],"],
      // site knowsAbout (lista larga)
      ["        knowsAbout: [\n          'Roman Colosseum',\n          'Ancient Rome History',\n          'Rome Tourism',\n          'Historical Tours',\n          'Travel Planning',\n          'Roman Forum',\n          'Palatine Hill'\n        ],",
       "        knowsAbout: [\n          'Las Vegas Tours',\n          'Grand Canyon Tours',\n          'Hoover Dam Tours',\n          'Las Vegas Shows',\n          'Helicopter Tours',\n          'Day Trips from Las Vegas',\n          'Travel Planning'\n        ],"],
    ],
  },
  {
    file: 'app/tour/[slug]/page.tsx',
    pairs: [
      ["permanentRedirect(post.redirectTo || (hub ? `/${hub.slug}` : '/tours/colosseum'));",
       "permanentRedirect(post.redirectTo || (hub ? `/${hub.slug}` : '/tours'));"],
    ],
  },
  {
    file: 'app/tours/[category]/page.tsx',
    pairs: [
      ['"name": "Colosseum Roman",',
       '"name": "LasVegasTour",'],
    ],
  },
  {
    file: 'app/[slug]/page.tsx',
    pairs: [
      ["[page.title.toLowerCase(), 'LasVegasTour', 'rome tours']",
       "[page.title.toLowerCase(), 'LasVegasTour', 'las vegas tours']"],
      ["{ '@type': 'ListItem', position: 2, name: 'Colosseum Tours', item: `${SITE_URL}/tours/colosseum` },",
       "{ '@type': 'ListItem', position: 2, name: 'Tours', item: `${SITE_URL}/tours` },"],
      ["          name: 'Colosseum',\n          description: `${hub.shortTitle} at the Roman Colosseum`,",
       "          name: 'Las Vegas',\n          description: `${hub.shortTitle} in Las Vegas`,"],
    ],
  },
];

let totalChanged = 0;
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
      missing.push(fromRaw.slice(0, 55).replace(/\n/g, ' '));
    }
  }
  if (!DRY && changed > 0) fs.writeFileSync(file, content);
  totalChanged += changed;
  console.log(`${file}: ${changed} reemplazo(s)${missing.length ? ` - ${missing.length} no encontrado(s)` : ''}`);
  missing.forEach((m) => console.log(`     · no encontrado (¿ya corregido?): ${m}...`));
}

console.log(`\n${DRY ? '[DRY-RUN] ' : ''}Total: ${totalChanged} reemplazos${DRY ? ' (no se escribió nada)' : ''}`);
