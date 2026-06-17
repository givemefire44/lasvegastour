// inject-extras.js - CLI + modulo. Cubre las 3 secciones simples que faltaban del body,
// alimentadas por el CORPUS (factsheet-source), con la misma voz advisor y guards que el resto.
//
// CLI: node inject-extras.js --section=<tour-format|best-for|insider-tip> [--slug=...] [--dry-run] [--limit=N]
//
// Por qué un solo archivo: las tres comparten guard/PT/CLI; solo cambian heading, prompt y modelo.
// Tour Format y Best For -> Sonnet 4.6 (datos/lista); Insider Tip -> Opus 4.8 (juicio de prosa).

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sourceForTour } from './factsheet-source.js';
import { VOICE_CORE, BANNED_SUPERLATIVES, COMPARISON_CUES, SOURCE_NARRATION } from './advisor-voice.js';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// --- La voz sale del VOICE_CORE compartido (alias para los sub-prompts) ---
const VOICE = VOICE_CORE;

// --- Registry de secciones ---
const SECTIONS = {
  'tour-format': {
    heading: '### 🏷️ Tour Format',
    find: 'tour format',
    fallback: ['best for', 'faq', 'compare'],
    model: 'claude-sonnet-4-6',
    isList: false,
    maxTokens: 300,
    buildPrompt: (tour, src) => `You are the lead travel advisor for lasvegastour.com ("Reviewed. Compared. Selected." - a FILTER, not a catalog). "Tour Format" is ONE plain sentence that classifies what kind of experience this is.

Write EXACTLY this, in markdown, and nothing else:

### 🏷️ Tour Format
[ONE factual sentence that classifies the tour: group type (small-group or private ONLY if the facts state it), the format (e.g. helicopter-and-ground combo, overnight stay, full-day trip, walking tour, kayak tour), the duration taken from the facts, and the main place(s) or activity it covers. Load-bearing facts only.]

${VOICE}

THIS TOUR:
Title: ${tour.title}

Facts established for this tour (your ONLY source):
${src}

Respond with ONLY the header and the one sentence.`,
  },

  'best-for': {
    heading: '### 👤 Best For',
    find: 'best for',
    fallback: ['insider tip', 'faq', 'compare'],
    model: 'claude-sonnet-4-6',
    isList: true,
    maxTokens: 500,
    buildPrompt: (tour, src) => `You are the lead travel advisor for lasvegastour.com ("Reviewed. Compared. Selected." - a FILTER, not a catalog). "Best For" lists the kinds of travelers this tour genuinely suits, based on what it actually is. It is a filter: honest about fit, never a sales pitch.

Write EXACTLY this, in markdown, and nothing else:

### 👤 Best For
[3 to 5 bullet lines. Each "- " names a traveler type or situation this tour fits, GROUNDED in a real fact about it: its physical level, its age/family suitability, what it includes, its duration, or its format. One short line each.]

RULES:
- Base every bullet on a real fact about THIS tour. No invented traits or moods.
${VOICE}

THIS TOUR:
Title: ${tour.title}

Facts established for this tour (your ONLY source):
${src}

Respond with ONLY the header and 3-5 bullets.`,
  },

  'insider-tip': {
    heading: '### 💡 Insider Tip',
    find: 'insider tip',
    fallback: ['faq', 'compare', 'best for'],
    model: 'claude-opus-4-8',
    isList: false,
    maxTokens: 400,
    buildPrompt: (tour, src) => `You are the lead travel advisor for lasvegastour.com ("Reviewed. Compared. Selected." - a FILTER, not a catalog). "Insider Tip" is ONE practical, non-obvious tip that helps a traveler on THIS specific tour - rooted in a real operational fact, not generic travel trivia.

Write EXACTLY this, in markdown, and nothing else:

### 💡 Insider Tip
[1 to 2 sentences. ONE non-obvious tip that helps a traveler DECIDE or PLAN smarter on THIS tour - something they would not get from a plain list of rules. Best angles: which option or upgrade is worth it and why, a timing or sequencing move, a booking-urgency note (an option or slot that sells out), a minimum-passenger requirement that affects booking, or a value nuance ("the only way to reach X is the Y upgrade"). Pick the single most useful, least obvious one. You MUST wrap the key action or decisive term in **bold** (e.g. **book the heli combo early**, **a minimum of 4 passengers**, **the Heli & Boat upgrade**) - exactly one phrase, the load-bearing decision, never an adjective.]

LANE DISCIPLINE - do NOT restate Practical Info:
- Practical Info already lists pickup, what to bring, bag/luggage limits, age/weight policies and cancellation. Do NOT repeat any of those here - a tip that just restates a restriction is wasted space.
- The tip must add something Practical Info does NOT cover: a decision (which tier), a strategy (when or in what order), or a booking insight (what fills up). If the only hard fact you have is a restriction, give the strategic angle on it (e.g. "book the heli combo early, those slots sell out") rather than restating the rule itself.

HARD RULES:
- MANDATORY BOLD: the tip is incomplete without exactly one **bolded** phrase - the key action or decisive figure the reader should act on (e.g. **book early**, **book as a group of 4**, **the Heli & Boat upgrade**). Bold the decision itself, never an adjective, never the whole sentence. A tip with no bold is a failed tip.
- Use ONLY facts present below. Do NOT invent weather, temperatures, elevations, distances, durations, fees or any number not in the facts. (Generic "pack layers, it gets cold" trivia is banned unless the facts state it.)
${VOICE}

THIS TOUR:
Title: ${tour.title}

Facts established for this tour (your ONLY source):
${src}

Respond with ONLY the header and the tip.`,
  },
};

// --- Guard determinístico: marketing/comparacion/narracion-de-fuente + cifras inventadas. Vocabulario centralizado en advisor-voice.js ---
function findViolations(text) {
  const hits = [];
  for (const re of [...BANNED_SUPERLATIVES, ...COMPARISON_CUES, ...SOURCE_NARRATION]) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return [...new Set(hits.map(h => h.toLowerCase()))];
}

const NUM = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
const TRAVEL_FIGURE = new RegExp(
  `\\b(?:roughly |about |around |approximately |nearly |over |under )?(${NUM})[\\s-]?(hour|hours|hr|hrs|minute|minutes|min|mins|mile|miles|km|kilometer|kilometers)\\b`,
  'ig'
);
const WORD2DIGIT = { one:'1', two:'2', three:'3', four:'4', five:'5', six:'6', seven:'7', eight:'8', nine:'9', ten:'10', eleven:'11', twelve:'12' };
const DIGIT2WORD = Object.fromEntries(Object.entries(WORD2DIGIT).map(([w, d]) => [d, w]));
const UNIT_FAMILY = {
  hour: ['hour','hours','hr','hrs'], minute: ['minute','minutes','min','mins'],
  mile: ['mile','miles'], km: ['km','kilometer','kilometers'],
};
function unitFamily(u) {
  u = u.toLowerCase();
  if (['hour','hours','hr','hrs'].includes(u)) return UNIT_FAMILY.hour;
  if (['minute','minutes','min','mins'].includes(u)) return UNIT_FAMILY.minute;
  if (['mile','miles'].includes(u)) return UNIT_FAMILY.mile;
  return UNIT_FAMILY.km;
}
function figureInSource(numTok, unit, src) {
  const t = numTok.toLowerCase().replace(/,/g, '');   // normaliza miles: "4,000" -> "4000"
  const nums = new Set([t]);
  if (/^\d/.test(t)) { if (DIGIT2WORD[t]) nums.add(DIGIT2WORD[t]); }
  else if (WORD2DIGIT[t]) nums.add(WORD2DIGIT[t]);
  const numAlt = [...nums].map(n => n.replace('.', '\\.')).join('|');
  const unitAlt = unitFamily(unit).join('|');
  const srcN = src.replace(/(\d),(?=\d{3}\b)/g, '$1'); // quita comas de miles en el source
  return new RegExp(`\\b(?:${numAlt})[\\s-]?(?:${unitAlt})\\b`, 'i').test(srcN);
}
function findUnsourcedFigures(text, sourceText) {
  const src = sourceText.toLowerCase();
  const out = [];
  for (const m of text.matchAll(TRAVEL_FIGURE)) {
    if (!figureInSource(m[1], m[2], src)) out.push(m[0].trim());
  }
  return [...new Set(out.map(s => s.toLowerCase()))];
}

async function correctiveRewrite(cfg, sectionMd, { marketing = [], figures = [] }) {
  const fixes = [];
  if (marketing.length) fixes.push(`Remove these marketing/comparison/source-narration phrases and their tone: ${marketing.join(', ')}.`);
  if (figures.length) fixes.push(`These figures are NOT supported by the facts - remove each or restate without the number: ${figures.join(', ')}.`);
  if (cfg.find === 'insider tip') fixes.push(`Keep exactly ONE **bolded** phrase on the key action or decisive term; if the draft lost it, add it back. Never bold an adjective.`);
  const prompt = `The markdown below is the "${cfg.heading.replace('### ', '')}" section of a travel page. It must be factual, never marketing, must not compare to any other tour, must not narrate its own source, and must not state any number the facts don't support.

Apply these fixes, keeping every supported FACT intact and introducing no new facts. Keep the exact "${cfg.heading}" header and the ${cfg.isList ? 'bullet-list' : 'short prose'} format.

${fixes.map(f => '- ' + f).join('\n')}

SECTION:
${sectionMd}

Respond with ONLY the corrected markdown.`;
  const msg = await anthropic.messages.create({
    model: cfg.model, max_tokens: cfg.maxTokens + 100,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text.trim();
}

// --- Portable Text helpers ---
const key = () => Math.random().toString(36).slice(2, 12);
const isHeading = b => b && b._type === 'block' && ['h1', 'h2', 'h3', 'h4'].includes(b.style);
const headingText = b => (b.children || []).map(c => c.text || '').join('');

function inlineToSpans(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(s => s !== '');
  const spans = parts.map(p =>
    (p.startsWith('**') && p.endsWith('**'))
      ? { _type: 'span', _key: key(), marks: ['strong'], text: p.slice(2, -2) }
      : { _type: 'span', _key: key(), marks: [], text: p }
  );
  return spans.length ? spans : [{ _type: 'span', _key: key(), marks: [], text }];
}
function markdownToBlocks(md) {
  const blocks = [];
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('### ')) {
      blocks.push({ _type: 'block', _key: key(), style: 'h3', markDefs: [], children: [{ _type: 'span', _key: key(), marks: [], text: line.slice(4).trim() }] });
    } else if (line.startsWith('- ')) {
      blocks.push({ _type: 'block', _key: key(), style: 'normal', listItem: 'bullet', markDefs: [], children: inlineToSpans(line.slice(2).trim()) });
    } else {
      blocks.push({ _type: 'block', _key: key(), style: 'normal', markDefs: [], children: inlineToSpans(line) });
    }
  }
  return blocks;
}

// Reemplaza la seccion (por cfg.find). Si no existe, la inserta antes de la primera de cfg.fallback (o al final).
function replaceSection(body, cfg, newBlocks) {
  const idx = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes(cfg.find));
  if (idx === -1) {
    let at = -1;
    for (const f of cfg.fallback) {
      at = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes(f));
      if (at !== -1) break;
    }
    if (at === -1) at = body.length;
    return { body: [...body.slice(0, at), ...newBlocks, ...body.slice(at)], existed: false };
  }
  let end = body.length;
  for (let i = idx + 1; i < body.length; i++) { if (isHeading(body[i])) { end = i; break; } }
  return { body: [...body.slice(0, idx), ...newBlocks, ...body.slice(end)], existed: true };
}

// ============================================================================
//  API del modulo
// ============================================================================
export async function injectSectionForSlug(slug, sectionKey, { dryRun = false } = {}) {
  const cfg = SECTIONS[sectionKey];
  if (!cfg) return { ok: false, reason: 'unknown-section', slug };

  const tour = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug && defined(body)][0] {
      _id, title, "slug": slug.current, body, getYourGuideUrl
    }
  `, { slug });
  if (!tour?._id) return { ok: false, reason: 'not-found-or-no-body', slug };

  const src = sourceForTour(tour);
  const sourceText = src.text;
  if (sourceText.replace(/\s/g, '').length < 80) return { ok: false, reason: 'source-too-thin', slug };

  const msg = await anthropic.messages.create({
    model: cfg.model,
    max_tokens: cfg.maxTokens,
    messages: [{ role: 'user', content: cfg.buildPrompt(tour, sourceText) }],
  });
  let sectionMd = msg.content[0].text.trim();

  let marketing = findViolations(sectionMd);
  let figures = findUnsourcedFigures(sectionMd, sourceText);
  let rewritten = false;
  if (marketing.length || figures.length) {
    sectionMd = await correctiveRewrite(cfg, sectionMd, { marketing, figures });
    rewritten = true;
    marketing = findViolations(sectionMd);
    figures = findUnsourcedFigures(sectionMd, sourceText);
  }
  const residual = [...marketing, ...figures];

  const newBlocks = markdownToBlocks(sectionMd);
  const { body: newBody, existed } = replaceSection(tour.body || [], cfg, newBlocks);

  const out = {
    ok: true, slug, section: sectionKey, existed, rewritten,
    origin: src.origin,
    units: newBlocks.filter(b => b.style === 'normal').length,
    residualViolations: residual,
    before: (tour.body || []).length, after: newBody.length,
    sectionMd,
  };
  if (dryRun) { out.dryRun = true; return out; }
  await sanity.patch(tour._id).set({ body: newBody }).commit();
  return out;
}

export async function fetchSectionSlugs({ limit = 500 } = {}) {
  const rows = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && defined(body)] | order(getYourGuideData.reviewCount desc) [0...${limit}]{ "slug": slug.current }
  `);
  return (rows || []).map(r => r.slug);
}

// ============================================================================
//  CLI
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  const SECTION = args.find(a => a.startsWith('--section='))?.split('=')[1] || null;
  const DRY_RUN = args.includes('--dry-run');
  const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '500', 10);
  const ONE_SLUG = args.find(a => a.startsWith('--slug='))?.split('=')[1] || null;

  if (!SECTION || !SECTIONS[SECTION]) {
    console.error(`--section requerido. Opciones: ${Object.keys(SECTIONS).join(', ')}`);
    process.exit(1);
  }
  const cfg = SECTIONS[SECTION];
  const DONE_FILE = `./inject-${SECTION}-done.json`;
  const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE)) : [];

  console.log(`\nINJECT "${cfg.heading.replace('### ', '')}"  |  section: ${SECTION}  |  model: ${cfg.model}  |  mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}  |  limit: ${LIMIT}${ONE_SLUG ? `  |  slug: ${ONE_SLUG}` : ''}`);
  console.log(`Already done: ${done.length}\n`);

  const slugs = ONE_SLUG ? [ONE_SLUG] : await fetchSectionSlugs({ limit: LIMIT });
  if (!slugs.length) { console.error('No tours found'); process.exit(1); }

  let preview = '', okCount = 0, errCount = 0, flagged = 0;
  for (const slug of slugs) {
    if (!ONE_SLUG && done.includes(slug)) { console.log(`skip (done): ${slug}`); continue; }
    try {
      const r = await injectSectionForSlug(slug, SECTION, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); continue; }
      const flag = r.residualViolations.length ? `  ⚠ RESIDUAL: ${r.residualViolations.join(', ')}` : '';
      if (r.residualViolations.length) flagged++;
      if (DRY_RUN) {
        preview += `\n========================================\n${slug}  | ${SECTION} | origin: ${r.origin} | existed: ${r.existed} | rewritten: ${r.rewritten}${flag}\n---- section ----\n${r.sectionMd}\n`;
        console.log(`preview: ${slug}  (${r.origin})${flag}`);
      } else {
        done.push(slug);
        fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
        console.log(`patched: ${slug}  (rewritten: ${r.rewritten})${flag}`);
        await new Promise(res => setTimeout(res, 1200));
      }
      okCount++;
    } catch (err) {
      console.error(`ERROR ${slug}: ${err.message}`);
      errCount++;
    }
  }

  if (DRY_RUN) {
    fs.writeFileSync(`./inject-${SECTION}-preview.md`, preview);
    console.log(`\nPreview -> inject-${SECTION}-preview.md  (ok: ${okCount}, flagged: ${flagged}, err: ${errCount})  - NOTHING written to Sanity`);
  } else {
    console.log(`\nDone. patched: ${okCount}, flagged: ${flagged}, errors: ${errCount}, total done: ${done.length}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
