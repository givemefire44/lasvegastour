// test-vegas-output.mjs — genera el contenido de 1 tour y lo vuelca a archivo, SIN subir a Sanity.
// Uso: node test-vegas-output.mjs "<URL de GetYourGuide>"
import { scrapeGetYourGuideTour } from './src/scraper.js';
import { generateTourContent } from './src/contentGenerator.js';
import fs from 'fs';

const url = process.argv[2];
if (!url || !url.includes('getyourguide.com')) {
  console.error('Uso: node test-vegas-output.mjs "<URL de GetYourGuide>"');
  process.exit(1);
}

console.log('Scrapeando:', url);
const tourData = await scrapeGetYourGuideTour(url);
console.log(`Titulo: ${tourData.title}`);
console.log(`Precio: ${tourData.price} | Duracion: ${tourData.duration} | Rating: ${tourData.rating} (${tourData.reviewCount} reviews)`);

console.log('\nGenerando contenido con el prompt nuevo (Vegas)...');
const content = await generateTourContent(tourData, []); // relatedTours vacio para la prueba

const out = `# TEST OUTPUT — ${tourData.title}

## METADATOS
- H1 (title): ${content.title}
- H2 (bodyTitle): ${content.bodyTitle}
- SEO Title: ${content.seoTitle}
- SEO Description (${(content.seoDescription || '').length} chars): ${content.seoDescription}
- Keywords: ${(content.seoKeywords || []).join(', ')}
- City: ${content.city}
- Editorial Rating: ${content.editorialRating ?? '(n/a)'}
- Editorial Review:
${content.editorialReview ?? '(sin review — rating 0)'}

## DATOS SCRAPEADOS (para contraste)
- Precio: ${tourData.price}
- Duracion: ${tourData.duration}
- Rating: ${tourData.rating} (${tourData.reviewCount} reviews)
- Provider: ${tourData.provider}
- Highlights: ${(tourData.highlights || []).join(' | ')}
- Includes: ${(tourData.includes || []).join(' | ')}

## BODY (las 13 secciones)
${content.body}

## FAQs (${(content.faqs || []).length})
${(content.faqs || []).map(f => `**Q: ${f.question}**\nA: ${f.answer}`).join('\n\n')}
`;

fs.writeFileSync('test-vegas-output.md', out, 'utf-8');
console.log('\n✅ Output escrito a test-vegas-output.md');
console.log('\n----------------------------------------------------------------\n');
console.log(out);
