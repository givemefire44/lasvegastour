/**
 * AI-Citable Sentences Injector
 * 
 * Reads all tours from Sanity, extracts sections 1 and 2,
 * rewrites them with AI-citable sentences using Claude API,
 * and patches the body back into Sanity.
 * 
 * Usage:
 *   node inject-citable.mjs                  # Dry run (preview only)
 *   node inject-citable.mjs --apply          # Apply changes to Sanity
 *   node inject-citable.mjs --slug=my-tour   # Process single tour
 *   node inject-citable.mjs --slug=my-tour --apply  # Process and apply single tour
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

console.log(`\n🔧 AI-Citable Sentences Injector`);
console.log(`   Mode: ${APPLY ? '🟢 APPLY (will write to Sanity)' : '🟡 DRY RUN (preview only)'}`);
if (TARGET_SLUG) console.log(`   Target: ${TARGET_SLUG}`);
console.log('');

// ========================================
// MAIN
// ========================================
async function main() {
  // Fetch all tours (or single tour)
  const query = TARGET_SLUG
    ? `*[_type == "post" && slug.current == $slug][0]{
        _id, title, slug, body,
        tourInfo{ duration, price, currency, location },
        tourFeatures{ freeCancellation, skipTheLine, smallGroupAvailable, hostGuide },
        getYourGuideData{ rating, reviewCount, provider }
      }`
    : `*[_type == "post" && defined(tourInfo)]{
        _id, title, slug, body,
        tourInfo{ duration, price, currency, location },
        tourFeatures{ freeCancellation, skipTheLine, smallGroupAvailable, hostGuide },
        getYourGuideData{ rating, reviewCount, provider }
      }`;

  const params = TARGET_SLUG ? { slug: TARGET_SLUG } : {};
  const result = await sanityClient.fetch(query, params);
  
  const tours = TARGET_SLUG ? (result ? [result] : []) : result;
  
  console.log(`📋 Found ${tours.length} tour(s) to process\n`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const tour of tours) {
    try {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📌 ${tour.title}`);
      console.log(`   Slug: ${tour.slug?.current}`);
      
      if (!tour.body || !Array.isArray(tour.body)) {
        console.log('   ⏭️  No body content, skipping');
        skipped++;
        continue;
      }

      // Extract sections 1 and 2
      const extraction = extractSections12(tour.body);
      
      if (!extraction) {
        console.log('   ⏭️  Could not find sections 1 and 2, skipping');
        skipped++;
        continue;
      }

      const { section1Text, section2Text, section1Start, section1End, section2Start, section2End } = extraction;
      
      console.log(`   📖 Section 1: ${section1Text.length} chars (blocks ${section1Start}-${section1End})`);
      console.log(`   📖 Section 2: ${section2Text.length} chars (blocks ${section2Start}-${section2End})`);

      // Build tour data for the prompt
      const tourData = {
        title: tour.title,
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

      // Call Claude to rewrite sections
      const rewritten = await rewriteWithCitableSentences(section1Text, section2Text, tourData);
      
      if (!rewritten) {
        console.log('   ❌ Claude did not return valid content, skipping');
        errors++;
        continue;
      }

      // Convert rewritten text to Portable Text blocks
      const newSection1Blocks = textToPortableText(rewritten.section1);
      const newSection2Blocks = textToPortableText(rewritten.section2);

      console.log(`   ✏️  New Section 1: ${newSection1Blocks.length} blocks`);
      console.log(`   ✏️  New Section 2: ${newSection2Blocks.length} blocks`);

      // Build new body
      const newBody = [
        ...tour.body.slice(0, section1Start),      // Everything before section 1 content
        ...newSection1Blocks,                        // New section 1
        ...tour.body.slice(section1End, section2Start), // H2 header for section 2 + anything between
        ...newSection2Blocks,                        // New section 2
        ...tour.body.slice(section2End),             // Everything after section 2
      ];

      if (APPLY) {
        await sanityClient.patch(tour._id)
          .set({ body: newBody })
          .commit();
        console.log(`   ✅ UPDATED in Sanity`);
      } else {
        console.log(`   🟡 DRY RUN — would update body (${tour.body.length} → ${newBody.length} blocks)`);
        console.log(`\n   --- NEW SECTION 1 PREVIEW ---`);
        console.log(`   ${rewritten.section1.substring(0, 300)}...`);
        console.log(`\n   --- NEW SECTION 2 PREVIEW ---`);
        console.log(`   ${rewritten.section2.substring(0, 300)}...`);
      }

      processed++;
      
      // Rate limit: wait between tours
      if (tours.length > 1) {
        console.log('   ⏳ Waiting 3s before next tour...');
        await new Promise(r => setTimeout(r, 3000));
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
// EXTRACT SECTIONS 1 AND 2 FROM BODY
// ========================================
function extractSections12(body) {
  let section1HeaderIdx = -1;
  let section2HeaderIdx = -1;
  let section3HeaderIdx = -1;

  for (let i = 0; i < body.length; i++) {
    const block = body[i];
    if (block._type !== 'block' || block.style !== 'h2') continue;
    
    const text = (block.children || []).map(c => c.text || '').join('').toLowerCase();
    
    if (text.includes('what makes this tour special') || text.match(/^1\./)) {
      section1HeaderIdx = i;
    } else if (text.includes('the experience') || text.includes('what to expect') || text.match(/^2\./)) {
      section2HeaderIdx = i;
    } else if (text.includes('tour highlights') || text.includes('highlights') || text.match(/^3\./)) {
      section3HeaderIdx = i;
    }
  }

  if (section1HeaderIdx === -1 || section2HeaderIdx === -1) {
    return null;
  }

  // Section 3 header marks the end of section 2.
  // If not found, look for the next H2 after section 2
  if (section3HeaderIdx === -1) {
    for (let i = section2HeaderIdx + 1; i < body.length; i++) {
      const block = body[i];
      if (block._type === 'block' && block.style === 'h2') {
        section3HeaderIdx = i;
        break;
      }
    }
  }

  if (section3HeaderIdx === -1) {
    return null;
  }

  // Section 1 content: blocks between section1 header and section2 header
  const section1Start = section1HeaderIdx + 1; // After the H2
  const section1End = section2HeaderIdx;        // Up to (not including) section 2 H2

  // Section 2 content: blocks between section2 header and section3 header
  const section2Start = section2HeaderIdx + 1;  // After the H2
  const section2End = section3HeaderIdx;        // Up to (not including) section 3 H2

  // Extract text
  const section1Text = extractTextFromBlocks(body.slice(section1Start, section1End));
  const section2Text = extractTextFromBlocks(body.slice(section2Start, section2End));

  if (!section1Text.trim() || !section2Text.trim()) {
    return null;
  }

  return {
    section1Text,
    section2Text,
    section1Start,
    section1End,
    section2Start,
    section2End
  };
}

function extractTextFromBlocks(blocks) {
  return blocks
    .filter(b => b._type === 'block')
    .map(b => (b.children || []).map(c => c.text || '').join(''))
    .join('\n\n');
}

// ========================================
// CALL CLAUDE TO REWRITE WITH CITABLE SENTENCES
// ========================================
async function rewriteWithCitableSentences(section1Text, section2Text, tourData) {
  const prompt = `You are rewriting two sections of a tour page to add AI-citable sentences. Your goal is to keep the narrative quality and flow while injecting 5 specific data-rich sentences that AI assistants (ChatGPT, Perplexity, Google AI Overviews) can cite directly as answers to tourist questions.

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

**CURRENT SECTION 1 (What Makes This Tour Special):**
${section1Text}

**CURRENT SECTION 2 (The Experience: What to Expect):**
${section2Text}

**YOUR TASK:**
Rewrite BOTH sections keeping the same narrative quality, approximate length, and factual content. But weave in exactly 5 citable sentences:

**In Section 1 (include 3 citable sentences):**
1. One combining price + duration + key inclusions (answers "how much does this tour cost and what's included?")
2. One describing specific areas/experiences accessed (answers "what do you see on this tour?")
3. One comparing to a standard ticket (answers "why pay more than a regular ticket?")

**In Section 2 (include 2 citable sentences):**
4. One about who it's best for + group size + languages (answers "who should book this tour?")
5. One about logistics: cancellation, booking tips, or practical info (answers "what do I need to know before booking?")

**RULES:**
- Keep approximately the same word count as the originals
- Do NOT add section headers (## headings) — just write the prose
- Do NOT add bullet points or lists
- Weave citable sentences naturally into the narrative — do NOT group them together
- Each citable sentence must contain at least 2 specific data points (numbers, prices, names, durations)
- Do NOT use generic filler like "unforgettable experience" or "once in a lifetime"
- Do NOT make up data not provided above — if data is N/A, skip that citable sentence
- Keep the same tone: authoritative, enthusiastic, practical

**OUTPUT FORMAT:**
Return EXACTLY this format with no extra text:

SECTION_1:
[rewritten section 1 text as paragraphs]

SECTION_2:
[rewritten section 2 text as paragraphs]`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = message.content[0].text;

    // Parse the response
    const section1Match = content.match(/SECTION_1:\s*\n([\s\S]*?)(?=\nSECTION_2:)/);
    const section2Match = content.match(/SECTION_2:\s*\n([\s\S]*?)$/);

    if (!section1Match || !section2Match) {
      console.log('   ⚠️  Could not parse Claude response format');
      return null;
    }

    return {
      section1: section1Match[1].trim(),
      section2: section2Match[1].trim()
    };

  } catch (err) {
    console.error(`   ❌ Claude API error: ${err.message}`);
    return null;
  }
}

// ========================================
// CONVERT TEXT TO PORTABLE TEXT BLOCKS
// ========================================
function textToPortableText(text) {
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  
  return paragraphs.map(para => ({
    _type: 'block',
    _key: generateKey(),
    style: 'normal',
    markDefs: [],
    children: parseInlineMarkdown(para.replace(/\n/g, ' ').trim())
  }));
}

function parseInlineMarkdown(text) {
  const children = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      children.push({
        _type: 'span',
        _key: generateKey(),
        text: part.slice(2, -2),
        marks: ['strong']
      });
    } else if (part) {
      children.push({
        _type: 'span',
        _key: generateKey(),
        text: part,
        marks: []
      });
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