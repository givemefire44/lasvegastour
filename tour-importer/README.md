# ColosseumRoman Tour Importer

Automated tour import system for colosseumroman.com. Scrapes tours from GetYourGuide, generates AI-powered content with Claude, and uploads to Sanity CMS.

## Features

- 🔍 **Smart Category Detection**: Automatically categorizes tours (Colosseum, Vatican, Rome)
- 🤖 **AI Content Generation**: Creates unique, SEO-optimized content for each tour
- 📸 **Image Processing**: Downloads and converts images (handles AVIF format)
- 🚀 **Sanity Integration**: Direct upload to your CMS
- 🔒 **Stealth Scraping**: Uses Puppeteer stealth plugin to avoid detection

## Installation

1. Copy this folder to your ColosseumRoman project:
   ```bash
   # From your ColosseumRoman project root
   cp -r /path/to/tour-importer ./tour-importer
   ```

2. Install dependencies:
   ```bash
   cd tour-importer
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your credentials
   ```

## Configuration

Edit `.env.local` with your credentials:

```env
SANITY_PROJECT_ID=your_project_id
SANITY_DATASET=production
SANITY_TOKEN=your_sanity_token
ANTHROPIC_API_KEY=your_anthropic_api_key
AFFILIATE_PARTNER_ID=2FVNDZG
```

## Usage

### Test Mode (Dry Run)
```bash
npm run import:dry "https://www.getyourguide.com/rome/colosseum-underground-tour-t12345"
```

### Production Import
```bash
npm run import "https://www.getyourguide.com/rome/colosseum-underground-tour-t12345"
```

Or with node directly:
```bash
node src/index.js "https://www.getyourguide.com/rome/vatican-museums-tour-t67890"
```

## Categories

The importer automatically detects tour categories:

| Category | Keywords | Examples |
|----------|----------|----------|
| **colosseum** | colosseum, arena floor, underground, gladiator | Skip-the-Line Colosseum Tour |
| **vatican** | vatican, sistine, st. peter | Vatican Museums Early Access |
| **rome** | trastevere, pantheon, trevi, food tour | Rome Night Walking Tour |

## File Structure

```
tour-importer/
├── package.json
├── .env.local.example
├── config.js              # Configuration loader
├── src/
│   ├── index.js           # Main orchestrator
│   ├── scraper.js         # GYG scraper (unchanged)
│   ├── contentGenerator.js # AI content with categories
│   ├── imageProcessor.js  # Image handling (unchanged)
│   └── sanityUploader.js  # Sanity upload
└── templates/
    └── post-template.js   # Claude prompt template
```

## After Import

1. **Assign Category in Sanity Studio**: Tours are created with `contentCategory` field but need manual category reference assignment
2. **Review Content**: Check generated content for accuracy
3. **Publish**: Set document status to published

## Workflow

```
GYG URL → Scraper → Image Processor → Content Generator → Sanity Upload
                                            ↓
                                     Claude API
                                     (category-aware prompts)
```

## Notes

- **Rate Limiting**: Default 5 second delay between scrapes
- **Images**: Downloads up to 5 images per tour (heroGallery)
- **Platform**: Set to `colosseumroman.com` in tour documents
- **Dependencies**: Requires Node.js 18+

## Troubleshooting

### "Missing Sanity credentials"
→ Check `.env.local` has all required variables

### Images not converting
→ Ensure `sharp` installed correctly: `npm rebuild sharp`

### Bot detection
→ Increase `RATE_LIMIT_MS` to 10000 or higher

## Files to Copy from ScootersTour

If adapting from existing ScootersTour importer:

| Copy | Don't Copy |
|------|------------|
| `src/index.js` | `node_modules/` |
| `src/scraper.js` | `.env.local` (create new) |
| `src/imageProcessor.js` | |

Replace these with ColosseumRoman versions:
- `config.js`
- `src/contentGenerator.js`
- `src/sanityUploader.js`
- `templates/post-template.js`
