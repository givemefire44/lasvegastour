// app/components/SchemaOrgHead.tsx
import {
  generatePageSchema,
  generateFAQSchema,
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
  const pageSchema = generatePageSchema(pageData, baseUrl);
  // Obtener FAQs si existen
  const faqItems = pageData.richSnippets?.faqItems;
  const hasFAQs = faqItems && faqItems.length > 0;
  // Verificar si el schema principal ya es FAQPage
  const isFAQPageType =
    pageData.richSnippets?.schemaType === 'FAQPage';
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

