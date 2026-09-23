// app/components/SchemaOrgHead.tsx
import {
  generatePageSchema,
  generateFAQSchema,
  generateResearchSchema,
  isResearchArticle,
} from '@/app/utils/schemaGenerator';
interface RelatedArticleRef {
  _id: string;
  title: string;
  slug: { current: string };
}
interface SchemaOrgHeadProps {
  pageData: {
    title: string;
    slug: { current: string };
    seoDescription?: string;
    seoImage?: any;
    publishedAt?: string;
    _updatedAt?: string;
    author?: string;
    richSnippets?: any;
    isPillar?: boolean;
    parentPillar?: { _ref?: string; _id?: string };
  };
  relatedArticles?: RelatedArticleRef[];
  baseUrl?: string;
}
export default function SchemaOrgHead({
  pageData,
  relatedArticles = [],
  baseUrl = 'https://lasvegastour.com',
}: SchemaOrgHeadProps) {
  // Si el articulo es del research program usa el schema enriquecido (Article + isBasedOn al
  // Dataset del corpus + isPartOf + hasPart + reviewedBy + citation). Si no, el de siempre.
  // Portado de colosseumroman-blog el 23 sep 2026: lasvegastour era el unico de los cuatro
  // sitios sin esto, y sus 45 articulos del research salian como WebPage sueltos.
  const isResearch = isResearchArticle(pageData);
  const pageSchema = isResearch
    ? generateResearchSchema(pageData, relatedArticles, baseUrl)
    : generatePageSchema(pageData, baseUrl);
  // Obtener FAQs si existen
  const faqItems = pageData.richSnippets?.faqItems;
  const hasFAQs = faqItems && faqItems.length > 0;
  // Verificar si el schema principal ya es FAQPage
  // Solo aplica a los que NO son research: el research siempre genera Article.
  const isFAQPageType =
    !isResearch && pageData.richSnippets?.schemaType === 'FAQPage';
  if (!pageSchema) {
    return null;
  }
  return (
    <>
      {/* Schema principal: Article, HowTo, WebPage, FAQPage, etc. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageSchema, null, 2),
        }}
      />
      {/* FAQ Schema independiente cuando hay FAQs y el schema principal no es FAQPage */}
      {hasFAQs && !isFAQPageType && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateFAQSchema(faqItems), null, 2),
          }}
        />
      )}
    </>
  );
}

