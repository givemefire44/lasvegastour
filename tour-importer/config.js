import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export const config = {
  sanity: {
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET,
    token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
    apiVersion: '2024-01-01',
    useCdn: false
  },
  
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  
  affiliate: {
    partnerId: process.env.AFFILIATE_PARTNER_ID || '2FVNDZG',
    utmMedium: 'online_publisher'
  },
  
  scraper: {
    rateLimitMs: parseInt(process.env.RATE_LIMIT_MS) || 5000,
    headless: true,
    userAgent: 'ColosseumRoman-Bot/1.0 (mario@colosseumroman.com)'
  },
  
  dryRun: process.env.DRY_RUN === 'true',
  
  siteUrl: 'https://colosseumroman.com',
  siteName: 'ColosseumRoman'
};

// Validation
if (!config.sanity.projectId || !config.sanity.token) {
  console.error('❌ Error: Missing Sanity credentials in .env.local');
  process.exit(1);
}

if (!config.anthropic.apiKey) {
  console.error('❌ Error: Missing ANTHROPIC_API_KEY in .env.local');
  process.exit(1);
}

console.log('✅ Configuration loaded successfully');
console.log(`📍 Mode: ${config.dryRun ? 'DRY RUN (test)' : 'PRODUCTION'}`);
