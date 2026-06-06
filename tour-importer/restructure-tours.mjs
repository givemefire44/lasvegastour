/**
 * Tour Content Restructurer v2 for colosseumroman.com
 * 
 * PRESERVES: Quick Answer + Comparison Table + Stats line + Intro (already well-made)
 * REWRITES: Narrative content → standard 8-section template + AI-citable sentences
 * 
 * Only processes tours MISSING "What Makes This Tour Special" + "The Experience" H2s.
 * 
 * Usage:
 *   node restructure-tours.mjs                  # Dry run (preview only)
 *   node restructure-tours.mjs --apply          # Apply changes to Sanity
 *   node restructure-tours.mjs --slug=my-tour   # Process single tour
 *   node restructure-tours.mjs --slug=my-tour --apply
 */

import { createClient } from '@sanity/client';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';

// ========================================
// CONFIG
// ========================================
const envFile = readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const sanityClient = createClient({
  projectId: env.SANITY_PROJECT_ID || env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: env.SANITY_DATASET || env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: env.SANITY_TOKEN,
  useCdn: false
});

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

const APPLY = process.argv.includes('--apply');
const SLUG_ARG = process.argv.find(a => a.startsWith('--slug='));
const TARGET_SLUG = SLUG_ARG ? SLUG_ARG.split('=')[1] : null;

console.log(`\n🔄 Tour Content Restructurer v2 (preserves Quick Answer + Table)`);
console.log(`   Mode: ${APPLY ? '🟢 APPLY (will write to Sanity)' : '🟡 DRY RUN (preview only)'}`);
if (TARGET_SLUG) console.log(`   Target: ${TARGET_SLUG}`);
console.log('');

// ========================================
// MAIN
// ========================================
async function main() {
  const query = TARGET_SLUG
    ? `*[_type == "post" && slug.current == $slug][0]{
        _id, title, slug, body, bookingUrl,
        tourInfo{ duration, price, currency, location },
        tourFeatures{ freeCancellation, skipTheLine, smallGroupAvailable, hostGuide },
        getYourGuideData{ rating, reviewCount, provider },
        getYourGuideUrl
      }`
    : `*[_type == "post" && defined(tourInfo)]{
        _id, title, slug, body, bookingUrl,
        tourInfo{ duration, price, currency, location },
        tourFeatures{ freeCancellation, skipTheLine, smallGroupAvailable, hostGuide },
        getYourGuideData{ rating, reviewCount, provider },
        getYourGuideUrl
      }`;

  const params = TARGET_SLUG ? { slug: TARGET_SLUG } : {};
  const result = await sanityClient.fetch(query, params);
  const allTours = TARGET_SLUG ? (result ? [result] : []) : result;

  // Filter: only tours that DON'T have the standard H2 structure
  const toursToProcess = allTours.filter(tour => {
    if (!tour.body || !Array.isArray(tour.body)) return false;
    if (!tour.slug?.current) return false;
    if (tour.slug.current === 'null' || tour.slug.current === 'image') return false;
    return !hasStandardStructure(tour.body);
  });

  console.log(`📋 Found ${allTours.length} total tours`);
  console.log(`📋 ${toursToProcess.length} need restructuring\n`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const tour of toursToProcess) {
    try {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📌 ${tour.title}`);
      console.log(`   Slug: ${tour.slug?.current}`);

      // ---- STEP 1: Extract preserved blocks (Quick Answer, stats line, table) ----
      const preserved = extractPreservedBlocks(tour.body);
      console.log(`   🔒 Preserved: QA=${preserved.quickAnswer ? 'YES' : 'NO'}, Stats=${preserved.statsLine ? 'YES' : 'NO'}, Table=${preserved.table ? 'YES' : 'NO'}, Intro=${preserved.introParas.length} paras`);

      // ---- STEP 2: Extract narrative content (everything else) ----
      const narrativeContent = extractNarrativeContent(tour.body, preserved);
      console.log(`   📖 Narrative content: ${narrativeContent.length} chars`);

      if (narrativeContent.length < 100) {
        console.log('   ⏭️  Too little narrative content, skipping');
        skipped++;
        continue;
      }

      // ---- STEP 3: Build tour data ----
      const tourData = {
        title: tour.title,
        slug: tour.slug?.current,
        price: tour.tourInfo?.price,
        currency: tour.tourInfo?.currency || 'USD',
        duration: tour.tourInfo?.duration,
        location: tour.tourInfo?.location || 'Rome, Italy',
        rating: tour.getYourGuideData?.rating,
        reviewCount: tour.getYourGuideData?.reviewCount,
        provider: tour.getYourGuideData?.provider,
        freeCancellation: tour.tourFeatures?.freeCancellation,
        skipTheLine: tour.tourFeatures?.skipTheLine,
        smallGroup: tour.tourFeatures?.smallGroupAvailable,
        languages: tour.tourFeatures?.hostGuide || 'English',
      };

      // ---- STEP 4: Claude rewrites ONLY the narrative into 8 sections ----
      const newSectionsMarkdown = await rewriteNarrativeContent(narrativeContent, tourData);

      if (!newSectionsMarkdown) {
        console.log('   ❌ Claude did not return valid content, skipping');
        errors++;
        continue;
      }

      // ---- STEP 5: Convert new sections to Portable Text ----
      const newSectionBlocks = convertToPortableText(newSectionsMarkdown);

      // ---- STEP 6: Assemble final body: preserved header + new sections ----
      const newBody = assembleBody(preserved, newSectionBlocks);
      console.log(`   ✏️  New body: ${newBody.length} blocks (was ${tour.body.length})`);

      if (APPLY) {
        await sanityClient.patch(tour._id)
          .set({ body: newBody })
          .commit();
        console.log(`   ✅ UPDATED in Sanity`);
      } else {
        console.log(`   🟡 DRY RUN — would update body (${tour.body.length} → ${newBody.length} blocks)`);
        console.log(`\n   --- PREVIEW (first 500 chars of new sections) ---`);
        console.log(`   ${newSectionsMarkdown.substring(0, 500)}...`);
      }

      processed++;

      if (toursToProcess.length > 1) {
        console.log('   ⏳ Waiting 5s before next tour...');
        await new Promise(r => setTimeout(r, 5000));
      }

    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Results: ${processed} processed, ${skipped} skipped, ${errors} errors`);
  if (!APPLY && processed > 0) {
    console.log(`\n💡 Run with --apply to write changes to Sanity`);
  }
}

// ========================================
// CHECK IF TOUR HAS STANDARD STRUCTURE
// ========================================
function hasStandardStructure(body) {
  const h2Texts = body
    .filter(b => b._type === 'block' && b.style === 'h2')
    .map(b => (b.children || []).map(c => c.text || '').join('').toLowerCase());

  const hasSection1 = h2Texts.some(t => t.includes('what makes this tour special'));
  const hasSection2 = h2Texts.some(t => t.includes('the experience') || t.includes('what to expect'));

  return hasSection1 && hasSection2;
}

// ========================================
// EXTRACT PRESERVED BLOCKS
// (Quick Answer H3, stats line, table, intro paragraphs)
// ========================================
function extractPreservedBlocks(body) {
  let quickAnswer = null;
  let statsLine = null;
  let table = null;
  let introParas = [];
  let firstSectionIdx = -1;

  // Track which block indices are "preserved" so we skip them in narrative extraction
  const preservedIndices = new Set();

  for (let i = 0; i < body.length; i++) {
    const block = body[i];
    const text = block._type === 'block'
      ? (block.children || []).map(c => c.text || '').join('')
      : '';

    // Stats line: has ⭐ and rating info
    if (!statsLine && block._type === 'block' && block.style !== 'h2' && block.style !== 'h3') {
      if (text.includes('⭐') && (text.includes('/5') || text.includes('reviews'))) {
        statsLine = block;
        preservedIndices.add(i);
        continue;
      }
    }

    // Quick Answer: H3 with 🎯
    if (!quickAnswer && block._type === 'block' && block.style === 'h3') {
      if (text.includes('🎯') || text.includes('Quick Answer')) {
        quickAnswer = block;
        preservedIndices.add(i);
        continue;
      }
    }

    // Table: simpleTable type
    if (!table && block._type === 'simpleTable') {
      table = block;
      preservedIndices.add(i);
      continue;
    }

    // H2 title header (the big decorative H2 at the top, NOT a section header)
    if (block._type === 'block' && block.style === 'h2') {
      preservedIndices.add(i); // Always skip H2 from narrative (we replace all H2s)
      continue;
    }

    // H3 section-like header (marks start of old narrative)
    if (block._type === 'block' && block.style === 'h3') {
      if (!text.includes('🎯') && !text.includes('Quick Answer')) {
        if (firstSectionIdx === -1) firstSectionIdx = i;
      }
      continue;
    }
  }

  // Collect intro paragraphs: normal blocks before firstSectionIdx that aren't preserved
  if (firstSectionIdx === -1) firstSectionIdx = body.length;

  for (let i = 0; i < firstSectionIdx; i++) {
    if (preservedIndices.has(i)) continue;
    const block = body[i];
    if (block._type === 'block' && block.style === 'normal') {
      const text = (block.children || []).map(c => c.text || '').join('').trim();
      if (text && text.length > 30) {
        introParas.push(block);
        preservedIndices.add(i);
      }
    }
  }

  return {
    statsLine,
    quickAnswer,
    table,
    introParas,
    firstSectionIdx,
    preservedIndices
  };
}

// ========================================
// EXTRACT NARRATIVE CONTENT
// ========================================
function extractNarrativeContent(body, preserved) {
  const parts = [];

  for (let i = 0; i < body.length; i++) {
    // Skip all preserved blocks
    if (preserved.preservedIndices.has(i)) continue;

    const block = body[i];
    if (block._type === 'block') {
      const text = (block.children || []).map(c => c.text || '').join('');
      if (text.trim()) {
        const prefix = block.style === 'h2' ? '## ' : block.style === 'h3' ? '### ' : '';
        const listPrefix = block.listItem === 'bullet' ? '- ' : block.listItem === 'number' ? '• ' : '';
        parts.push(listPrefix + prefix + text);
      }
    }
  }

  return parts.join('\n\n');
}

// ========================================
// CALL CLAUDE TO REWRITE NARRATIVE INTO 8 SECTIONS
// ========================================
async function rewriteNarrativeContent(narrativeContent, tourData) {
  const prompt = `You are restructuring a tour page for colosseumroman.com. The existing content has good information but uses a non-standard layout. Rewrite it into the standard 8-section template with AI-citable sentences.

**IMPORTANT: DO NOT output a Quick Answer, stats line, intro paragraph, or comparison table. Those already exist and will be preserved. Only output the 8 sections below.**

**TOUR DATA:**
- Title: ${tourData.title}
- Price: $${tourData.price || 'N/A'}
- Duration: ${tourData.duration || 'N/A'}
- Rating: ${tourData.rating || 'N/A'}/5 (${tourData.reviewCount || 0} reviews)
- Provider: ${tourData.provider || 'N/A'}
- Location: ${tourData.location || 'Rome, Italy'}
- Languages: ${tourData.languages || 'English'}
- Free cancellation: ${tourData.freeCancellation ? 'Yes' : 'No'}
- Skip the line: ${tourData.skipTheLine ? 'Yes' : 'No'}
- Small groups: ${tourData.smallGroup ? 'Yes' : 'No'}

**EXISTING CONTENT (reuse facts and details, rewrite into new structure):**
${narrativeContent}

**OUTPUT EXACTLY THIS STRUCTURE (nothing before section 1, nothing after section 8):**

## 1. What Makes This Tour Special
(150-200 words, 2 paragraphs. MUST contain 3 AI-citable sentences woven naturally into prose:)
- Frase 1: price + duration + key inclusions (answers "how much does this Colosseum tour cost and what's included?")
- Frase 2: specific areas/experiences accessed (answers "what do you see on this tour?")
- Frase 3: why book guided tour vs standard ticket (answers "why pay more than a regular Colosseum ticket?" — e.g. standard ticket restricts to upper levels only, this adds underground + arena floor + expert guide)

## 2. The Experience: What to Expect
(200-250 words, 2-3 paragraphs. MUST contain 2 AI-citable sentences woven naturally into prose:)
- Frase 4: who it's best for + group size + languages (answers "who should book this tour?")
- Frase 5: logistics — cancellation policy, booking tips, time slot strictness (answers "what do I need to know before booking?")

## 3. Tour Highlights
(5-7 bullet points of specific highlights. Use - for bullets.)

## 4. What's Included ✓
(Bullet list of what's included. Use - for bullets.)

## 5. Not Included ✗
(Bullet list of what's NOT included. Use - for bullets.)

## 6. Curator's Tip 💡
(50-80 words. One practical insider tip — best time to go, what to wear, photography tips, etc.)

## 7. Review Snapshot 💬
(100-150 words synthesizing traveler reviews — what they praise, any common concerns.)

## 8. Final Word 🔚
(80-100 words wrapping up the recommendation, ending with:)
**Recommended for:** [4 relevant traveler profiles like: first-time Rome visitors, history buffs, families with children, photography enthusiasts]

**AI-CITABLE SENTENCE RULES:**
- Each must contain at least 2 specific data points (numbers, prices, site names, durations)
- Must flow naturally in the prose — NOT grouped together, NOT labeled, NOT at the start of a paragraph
- Must be complete, self-contained sentences an AI assistant can quote verbatim as an answer
- Do NOT use generic filler like "unforgettable experience" or "once in a lifetime"
- Do NOT invent data not provided above — if data is N/A, skip that citable sentence

**FORMATTING RULES:**
- Use ## for all section headers (H2)
- Use - for all bullet points
- Use **bold** only for "Recommended for:" at the end
- Do NOT include ANY content before "## 1." — no stats, no Quick Answer, no table, no preamble
- Do NOT include metadata or anything after the Recommended for: line in section 8

Write the 8 sections now.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let content = message.content[0].text.trim();

    // Strip anything before first ## 1. (in case Claude adds preamble)
    const firstSection = content.indexOf('## 1.');
    if (firstSection > 0) {
      content = content.substring(firstSection);
    }

    // Validation
    if (!content.includes('## 1.') || !content.includes('## 2.')) {
      console.log('   ⚠️  Response missing required sections');
      return null;
    }

    return content;

  } catch (err) {
    console.error(`   ❌ Claude API error: ${err.message}`);
    return null;
  }
}

// ========================================
// ASSEMBLE FINAL BODY
// Order: statsLine → QuickAnswer → introParas → table → newSections
// ========================================
function assembleBody(preserved, newSectionBlocks) {
  const body = [];

  if (preserved.statsLine) body.push(preserved.statsLine);
  if (preserved.quickAnswer) body.push(preserved.quickAnswer);
  for (const para of preserved.introParas.slice(0, 2)) body.push(para);
  if (preserved.table) body.push(preserved.table);
  body.push(...newSectionBlocks);

  return body;
}

// ========================================
// CONVERT MARKDOWN TO PORTABLE TEXT
// ========================================
function convertToPortableText(markdown) {
  if (!markdown) return [];

  const blocks = [];
  const lines = markdown.split('\n');
  let currentBlock = null;
  let listItems = [];
  let listType = null;
  let inCodeBlock = false;
  let codeBlockType = '';
  let codeBlockContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockType = line.trim().replace('```', '').trim();
        codeBlockContent = [];
        flushCurrentBlock();
        flushList();
        continue;
      } else {
        inCodeBlock = false;
        if (codeBlockType === 'table-json') {
          try {
            const tableData = JSON.parse(codeBlockContent.join('\n'));
            if (tableData.rows && Array.isArray(tableData.rows) && tableData.rows.length >= 2) {
              blocks.push({
                _type: 'simpleTable',
                _key: generateKey(),
                title: tableData.title || '',
                rows: tableData.rows.map(row => ({
                  _type: 'tableRow',
                  _key: generateKey(),
                  cells: (row.cells || []).map(cell => typeof cell === 'string' ? cell.trim() : cell)
                }))
              });
            }
          } catch (error) {
            console.error('   ❌ Failed to parse table JSON:', error.message);
          }
        }
        codeBlockType = '';
        codeBlockContent = [];
        continue;
      }
    }

    if (inCodeBlock) { codeBlockContent.push(line); continue; }

    // H2
    if (line.startsWith('## ')) {
      flushCurrentBlock(); flushList();
      blocks.push({
        _type: 'block', _key: generateKey(), style: 'h2', markDefs: [],
        children: [{ _type: 'span', _key: generateKey(), text: line.replace('## ', '').trim(), marks: [] }]
      });
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      flushCurrentBlock(); flushList();
      blocks.push({
        _type: 'block', _key: generateKey(), style: 'h3', markDefs: [],
        children: [{ _type: 'span', _key: generateKey(), text: line.replace('### ', '').trim(), marks: [] }]
      });
      continue;
    }

    // Bullets
    if (line.match(/^[-*•]\s/)) {
      flushCurrentBlock();
      if (listType !== 'bullet') { flushList(); listType = 'bullet'; }
      listItems.push({
        _type: 'block', _key: generateKey(), style: 'normal', listItem: 'bullet', level: 1, markDefs: [],
        children: parseInlineMarkdown(line.replace(/^[-*•]\s/, '').trim())
      });
      continue;
    }

    // Blockquotes
    if (line.startsWith('> ')) {
      flushCurrentBlock(); flushList();
      blocks.push({
        _type: 'block', _key: generateKey(), style: 'blockquote', markDefs: [],
        children: parseInlineMarkdown(line.replace('> ', '').trim())
      });
      continue;
    }

    // Empty
    if (line.trim() === '') { flushCurrentBlock(); flushList(); continue; }

    // Paragraph continuation
    flushList();
    if (currentBlock) { currentBlock.text += ' ' + line.trim(); }
    else { currentBlock = { text: line.trim() }; }
  }

  flushCurrentBlock();
  flushList();

  function flushCurrentBlock() {
    if (currentBlock) {
      blocks.push({
        _type: 'block', _key: generateKey(), style: 'normal', markDefs: [],
        children: parseInlineMarkdown(currentBlock.text)
      });
      currentBlock = null;
    }
  }

  function flushList() {
    if (listItems.length > 0) { blocks.push(...listItems); listItems = []; listType = null; }
  }

  return blocks;
}

function parseInlineMarkdown(text) {
  const children = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      children.push({ _type: 'span', _key: generateKey(), text: part.slice(2, -2), marks: ['strong'] });
    } else if (part) {
      children.push({ _type: 'span', _key: generateKey(), text: part, marks: [] });
    }
  }

  return children.length > 0
    ? children
    : [{ _type: 'span', _key: generateKey(), text: text, marks: [] }];
}

function generateKey() {
  return Math.random().toString(36).substring(2, 10);
}

// ========================================
// RUN
// ========================================
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});