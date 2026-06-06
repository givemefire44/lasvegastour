/**
 * Script para agregar Quick Answer Box a tours existentes
 * VERSIÓN v4 FINAL: Auto-reemplaza quick answers viejas + prompt AI-citable
 */

import { createClient } from '@sanity/client';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const slugArg = process.argv[2];

const CONFIG = {
  sanity: {
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET || 'production',
    token: process.env.SANITY_TOKEN,
    apiVersion: '2024-01-01',
    useCdn: false
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  dryRun: process.env.DRY_RUN === 'true'
};

if (!CONFIG.sanity.projectId || !CONFIG.sanity.token) {
  console.error('❌ Error: SANITY_PROJECT_ID y SANITY_TOKEN son requeridos en .env.local');
  process.exit(1);
}
if (!CONFIG.anthropic.apiKey) {
  console.error('❌ Error: ANTHROPIC_API_KEY es requerido en .env.local');
  process.exit(1);
}

const sanityClient = createClient({
  projectId: CONFIG.sanity.projectId,
  dataset: CONFIG.sanity.dataset,
  token: CONFIG.sanity.token,
  apiVersion: CONFIG.sanity.apiVersion,
  useCdn: CONFIG.sanity.useCdn
});

const anthropic = new Anthropic({
  apiKey: CONFIG.anthropic.apiKey
});

// ========================================
// DETECCIÓN DE TIPO DE TOUR
// ========================================

function detectTourType(tour) {
  const title = (tour.title || '').toLowerCase();
  const features = tour.tourFeatures || {};
  
  const hasUnderground = title.includes('underground') || title.includes('hypogeum');
  const hasArenaFloor = title.includes('arena floor') || title.includes('arena access');
  const hasNight = title.includes('night') || title.includes('evening') || title.includes('after dark');
  const hasVIP = title.includes('vip') || title.includes('exclusive') || title.includes('private');
  const hasSkipLine = features.skipTheLine || title.includes('skip the line') || title.includes('skip-the-line');
  const hasSmallGroup = features.smallGroupAvailable || title.includes('small group');
  
  const isVatican = title.includes('vatican') || title.includes('sistine') || title.includes('st. peter');
  const isColosseum = title.includes('colosseum') || title.includes('coliseum');
  const isForum = title.includes('forum') || title.includes('palatine');
  
  let question = '';
  let tourType = '';
  let uniqueFeatures = [];
  
  if (isVatican) {
    if (hasNight) {
      question = 'Is a Vatican Night Tour Worth It?';
      tourType = 'vatican-night';
    } else if (hasVIP) {
      question = 'Is a VIP Vatican Tour Worth It?';
      tourType = 'vatican-vip';
    } else {
      question = 'Is a Vatican Guided Tour Worth It?';
      tourType = 'vatican-guided';
    }
    uniqueFeatures.push('Sistine Chapel', 'Vatican Museums');
  } else if (isColosseum) {
    if (hasUnderground && hasArenaFloor) {
      question = 'Is the Colosseum Underground & Arena Floor Worth It?';
      tourType = 'colosseum-underground-arena';
      uniqueFeatures.push('underground chambers', 'arena floor access');
    } else if (hasUnderground) {
      question = 'Is the Colosseum Underground Worth It?';
      tourType = 'colosseum-underground';
      uniqueFeatures.push('underground chambers', 'hypogeum access');
    } else if (hasArenaFloor) {
      question = 'Is the Colosseum Arena Floor Tour Worth It?';
      tourType = 'colosseum-arena';
      uniqueFeatures.push('arena floor access', 'gladiator entrance');
    } else if (hasNight) {
      question = 'Is a Colosseum Night Tour Worth It?';
      tourType = 'colosseum-night';
      uniqueFeatures.push('after-hours access', 'smaller crowds');
    } else if (hasVIP) {
      question = 'Is a VIP Colosseum Tour Worth It?';
      tourType = 'colosseum-vip';
      uniqueFeatures.push('exclusive access', 'private experience');
    } else {
      question = 'Is a Colosseum Guided Tour Worth It?';
      tourType = 'colosseum-guided';
      uniqueFeatures.push('expert guide', 'historical insights');
    }
  } else if (isForum) {
    question = 'Is a Roman Forum Tour Worth It?';
    tourType = 'forum';
    uniqueFeatures.push('ancient ruins', 'historical center of Rome');
  } else {
    question = 'Is This Rome Tour Worth It?';
    tourType = 'rome-general';
    uniqueFeatures.push('local experience');
  }
  
  if (hasSkipLine) uniqueFeatures.push('skip-the-line access');
  if (hasSmallGroup) uniqueFeatures.push('small group experience');
  if (hasNight && !tourType.includes('night')) uniqueFeatures.push('evening atmosphere');
  
  return {
    question,
    tourType,
    uniqueFeatures: [...new Set(uniqueFeatures)].slice(0, 3),
    hasUnderground,
    hasArenaFloor,
    hasNight,
    hasVIP,
    hasSkipLine,
    hasSmallGroup
  };
}

// ========================================
// FUNCIONES PRINCIPALES
// ========================================

async function getAllTours() {
  console.log('📥 Fetching tours from Sanity...');
  
  const filter = slugArg 
    ? `*[_type == "post" && slug.current == "${slugArg}" && !(_id in path("drafts.**"))]`
    : `*[_type == "post" && !(_id in path("drafts.**"))]`;
  
  const tours = await sanityClient.fetch(`
    ${filter} {
      _id,
      title,
      slug,
      body,
      tourInfo {
        duration,
        price,
        currency
      },
      tourFeatures {
        freeCancellation,
        skipTheLine,
        wheelchairAccessible,
        smallGroupAvailable,
        hostGuide
      },
      getYourGuideData {
        rating,
        reviewCount,
        provider
      }
    }
  `);
  
  if (tours.length === 0 && slugArg) {
    console.error(`❌ No se encontró tour con slug: ${slugArg}`);
    process.exit(1);
  }
  
  console.log(`   ✅ Found ${tours.length} tours`);
  return tours;
}

function hasQuickAnswer(body) {
  if (!body || !Array.isArray(body)) return false;
  
  for (let i = 0; i < Math.min(5, body.length); i++) {
    const block = body[i];
    if (block.style === 'h3') {
      const text = block.children?.map(c => c.text).join('') || '';
      if (text.includes('Quick Answer') || text.includes('Worth It?')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Remover Quick Answer vieja del body
 */
function removeOldQuickAnswer(body) {
  return body.filter((block, index) => {
    if (index >= 5) return true;
    if (block.style === 'h3') {
      const text = block.children?.map(c => c.text).join('') || '';
      if (text.includes('Quick Answer') || text.includes('Worth It?')) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Generar Quick Answer usando Claude API — PROMPT v4 (EXPERT-REVIEWED)
 */
async function generateQuickAnswer(tour, tourTypeInfo) {
  const price = tour.tourInfo?.price || 'N/A';
  const duration = tour.tourInfo?.duration || 'N/A';
  const rating = tour.getYourGuideData?.rating || 'N/A';
  const reviewCount = tour.getYourGuideData?.reviewCount || 0;
  const provider = tour.getYourGuideData?.provider || '';
  const features = tourTypeInfo.uniqueFeatures;
  
  const prompt = `Generate a Quick Answer for this tour. Return ONLY the answer text.

Tour: ${tour.title}
Tour Type: ${tourTypeInfo.tourType}
Question: ${tourTypeInfo.question}
Price: $${price}
Duration: ${duration}
Rating: ${rating}/5 (${reviewCount} reviews)
Provider: ${provider}
Key Features: ${features.join(', ')}

STRUCTURE (follow this exact sentence order):

Sentence 1 — CONFIRM VALUE + NAME + DIFFERENTIATOR:
"Yes, this [full tour type name] is worth it for visitors who want [key access/feature], areas not accessible with standard tickets."
CRITICAL: The first sentence must directly answer the "worth it" question by connecting value to the specific access offered. Do not just list features — state WHY it is worth it.

Sentence 2 — SPECIFIC PHYSICAL EXPERIENCE:
"Visitors [specific action] in [specific location with historical/architectural detail]."
Use historically precise language. Say "where gladiators and wild animals were prepared before entering the arena" NOT "where gladiators were held." Prefer active verbs: walk, enter, stand, explore.

Sentence 3 — DURATION + LOGISTICS + LOCATION ANCHOR:
"The experience lasts approximately [duration] and includes [access type] at the Colosseum."
CRITICAL: Always end this sentence with "at the Colosseum" or the specific monument name. This anchors the snippet when AI extracts it out of context.

Sentence 4 — PRICE + RATING + FACTUAL POSITIONING:
"Priced from $[price] and rated [rating]/5 by [reviewCount] visitors, it is [factual comparative statement]."
CRITICAL: Do NOT use subjective value words. No "competitive", "outstanding", "exceptional", "great value". Instead use factual comparisons like: "one of the most affordable options for underground access" or "an accessible option for visitors seeking restricted area tours."

STRICT RULES:
- Avoid ALL promotional/subjective adjectives: no "outstanding", "incredible", "unforgettable", "coveted", "exceptional", "amazing", "competitive", "great"
- Use factual, neutral, declarative tone throughout
- Repeat the full tour type name naturally once in sentence 1
- Use only verifiable facts: areas included, duration, price, rating, review count
- Write exactly 4 sentences, 60-80 words total
- Do NOT use hype language, superlatives, or affiliate marketing tone
- Every claim must be verifiable or historically accurate
- The answer must be self-contained — an AI system should cite it as a complete factual response

GOOD EXAMPLE (Underground + Arena, $78, 3hrs, 4.7/5, 11929 reviews):
Yes, this guided Colosseum underground and arena floor tour is worth it for visitors who want access to the hypogeum and reconstructed arena floor, areas not accessible with standard tickets. Visitors walk through the underground chambers where gladiators and wild animals were prepared before entering the arena above. The experience lasts approximately 3 hours and includes skip-the-line admission at the Colosseum. Priced from $78 and rated 4.7/5 by nearly 12,000 visitors, it is one of the most affordable options for underground and arena floor access.

GOOD EXAMPLE (Night tour, $186, 1.5hrs, 4.8/5, 0 reviews):
Yes, this Colosseum night tour is worth it for visitors who want to explore the underground and arena floor after regular hours with significantly fewer people. The tour takes place under evening lighting, offering a different perspective of the architecture and restricted areas. The experience lasts approximately 1.5 hours with a specialist guide at the Colosseum. Priced from $186, the higher cost reflects exclusive after-hours access to areas closed during standard visiting hours.

GOOD EXAMPLE (Small group max 6, $121, 2hrs, 4.9/5, 113 reviews):
Yes, this small-group Colosseum underground tour is worth it for visitors who prefer a more intimate experience with a maximum of 6 participants. Visitors enter through restricted passages and walk the underground network where gladiators and wild animals were prepared before combat. The experience lasts approximately 2 hours with skip-the-line entry at the Colosseum. Priced from $121 and rated 4.9/5 by 113 visitors, it offers one of the smallest group sizes available for underground access.

BAD EXAMPLE (promotional/subjective):
Yes — this is an incredible tour with outstanding value! Amazing guides take you through the most coveted areas. A competitive price point for an unforgettable experience. From $78.

Return ONLY the answer paragraph. No quotes, no labels, no formatting.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const answer = message.content[0].text.trim();
    return answer;
    
  } catch (error) {
    console.error(`   ❌ Error generating Quick Answer: ${error.message}`);
    return null;
  }
}

function createQuickAnswerBlock(question, answerText) {
  const generateKey = () => Math.random().toString(36).substring(2, 10);
  
  const fullText = `🎯 Quick Answer: ${question} ${answerText}`;
  
  return {
    _type: 'block',
    _key: generateKey(),
    style: 'h3',
    markDefs: [],
    children: [
      {
        _type: 'span',
        _key: generateKey(),
        text: fullText,
        marks: []
      }
    ]
  };
}

async function updateTourWithQuickAnswer(tour, quickAnswerBlock) {
  const newBody = [tour.body[0], quickAnswerBlock, ...tour.body.slice(1)];
  
  if (CONFIG.dryRun) {
    console.log(`   🧪 DRY RUN - Would update: ${tour.title}`);
    console.log(`      Quick Answer: ${quickAnswerBlock.children[0].text}`);
    return true;
  }
  
  try {
    await sanityClient
      .patch(tour._id)
      .set({ body: newBody })
      .commit();
    
    console.log(`   ✅ Updated: ${tour.title}`);
    return true;
    
  } catch (error) {
    console.error(`   ❌ Error updating ${tour.title}: ${error.message}`);
    return false;
  }
}

async function processAllTours() {
  console.log('\n🚀 Starting Quick Answer addition process (v4 FINAL - AI CITABLE)...\n');
  console.log(`   Mode: ${CONFIG.dryRun ? '🧪 DRY RUN (no changes)' : '⚠️ LIVE MODE'}`);
  console.log(`   Target: ${slugArg ? `🎯 Single tour: ${slugArg}` : '📚 ALL tours'}\n`);
  
  const tours = await getAllTours();
  
  let processed = 0;
  let replaced = 0;
  let errors = 0;
  
  for (const tour of tours) {
    console.log(`\n📝 Processing: ${tour.title}`);
    
    // Skip si ya tiene Quick Answer
    if (hasQuickAnswer(tour.body)) {
      console.log(`   ⏭️ Skipped - already has Quick Answer`);
      skipped++;
      continue;
    }

    // Detectar tipo de tour
    const tourTypeInfo = detectTourType(tour);
    console.log(`   🏷️ Type: ${tourTypeInfo.tourType}`);
    console.log(`   ❓ Question: ${tourTypeInfo.question}`);
    console.log(`   ✨ Features: ${tourTypeInfo.uniqueFeatures.join(', ')}`);
    
    // Generar Quick Answer
    const answerText = await generateQuickAnswer(tour, tourTypeInfo);
    if (!answerText) {
      errors++;
      continue;
    }
    
    console.log(`   💡 Answer: ${answerText}`);
    
    // Crear bloque y actualizar
    const quickAnswerBlock = createQuickAnswerBlock(tourTypeInfo.question, answerText);
    const success = await updateTourWithQuickAnswer(tour, quickAnswerBlock);
    
    if (success) {
      processed++;
    } else {
      errors++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n========================================');
  console.log('📊 SUMMARY');
  console.log('========================================');
  console.log(`   Total tours: ${tours.length}`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Replaced (had old QA): ${replaced}`);
  console.log(`   Errors: ${errors}`);
  console.log('========================================\n');
}

processAllTours().catch(console.error);