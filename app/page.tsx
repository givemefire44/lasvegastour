import { client } from '@/sanity/lib/client'
import { Metadata } from 'next'
import Container from "./components/Container";
import Footer from "./components/Footer";
import HubChips from './components/HubChips';
import {
  HomeHero, TrustStrip, AdviceBox, Decisions, FeaturedTours, ResearchBlock, PlanYourTrip, HomeFaq, GuidesLibrary,
  FEATURED, DATASET_DOI, homeFaq, type FeaturedTour,
} from './components/home/HomeSections';
import { IMG } from './components/home/homeImages';

// Fecha en que se reviso el contenido de la home contra las guias y pilares publicados.
const CHECKED_ISO = '2026-11-15';

export const revalidate = 180;
export const dynamic = 'force-static'
export const dynamicParams = true
export const fetchCache = 'default-cache'

const getHomepage = async () => {
  return await client.fetch(`
    *[_type == "homepage"][0]{ seo{ title, description, keywords } }
  `, {}, { next: { revalidate: 300 } })
}

// Los tres tours elegidos (FEATURED). Solo se LEEN: precio, nota y reseñas son del feed.
const getFeaturedTours = async (): Promise<FeaturedTour[]> => {
  const slugs = FEATURED.map((f) => f.slug)
  const rows = await client.fetch(`
    *[_type == "post" && slug.current in $slugs && discontinued != true && !(_id in path("drafts.**"))]{
      "slug": slug.current,
      title,
      "image": coalesce(mainImage.asset->url, heroGallery[0].asset->url),
      "imageAlt": coalesce(mainImage.alt, heroGallery[0].alt),
      "price": tourInfo.price,
      "currency": tourInfo.currency,
      "duration": tourInfo.duration,
      "rating": getYourGuideData.rating,
      "reviewCount": getYourGuideData.reviewCount
    }
  `, { slugs }, { next: { revalidate: 180 } })
  return (rows || []).map((t: FeaturedTour) => ({
    ...t,
    image: t.image ? `${t.image}?w=720&h=540&fit=crop&auto=format` : undefined,
  }))
}

export async function generateMetadata(): Promise<Metadata> {
  const homepage = await getHomepage()
  const title = homepage?.seo?.title || 'Las Vegas Tours — What to Know Before You Book'
  const description = homepage?.seo?.description || 'What do Las Vegas tour reviews really tell you? We analyze real traveler data, hidden trade-offs and booking details to help you choose the right tour.'
  const keywords = homepage?.seo?.keywords || ['Las Vegas tours', 'Grand Canyon tours', 'Las Vegas shows', 'helicopter tours']
  // Imagen social = la foto del hero (15 nov 2026). El homepage de Sanity no tiene imagen y el
  // fallback /images/default-social.webp daba 404: los links compartidos salian sin imagen.
  const socialImage = `${IMG.hero.src}?w=1200&h=630&fit=crop&fm=jpg&q=80`
  const baseUrl = 'https://lasvegastour.com'

  return {
    title,
    description,
    keywords,
    authors: [{ name: 'Mario Dalo', url: 'https://intercoper.com/author/mario-dalo' }],
    creator: 'LasVegasTour',
    publisher: 'LasVegasTour',
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: baseUrl,
      title,
      description,
      siteName: 'LasVegasTour',
      images: [{ url: socialImage, width: 1200, height: 630, alt: IMG.hero.alt, type: 'image/jpeg' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
    },
    alternates: {
      canonical: baseUrl,
      languages: { 'en': baseUrl, 'x-default': baseUrl },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  }
}

export default async function HomePage() {
  const tours = await getFeaturedTours()

  // Grafo enlazado por @id, como en ColosseumRoman (15 nov 2026). El logo apuntaba a /logo.png,
  // que da 404; el real es app/icon.png (192x192, servido en /icon.png).
  const ORG_ID = "https://lasvegastour.com/#organization";
  const SITE_ID = "https://lasvegastour.com/#website";
  const LIST_ID = "https://lasvegastour.com/#featured-tours";
  const LOGO = { "@type": "ImageObject", "url": "https://lasvegastour.com/icon.png", "width": 192, "height": 192 };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    "name": "LasVegasTour",
    "alternateName": ["Las Vegas Tour", "lasvegastour.com"],
    "url": "https://lasvegastour.com",
    "logo": LOGO,
    "description": "Independent editorial guide to Las Vegas shows, helicopter flights and day trips. Advice comes from a research corpus of traveler reviews and from reading what each listing includes. Bookings are made through the booking platform at the listed price, with no added fee.",
    "parentOrganization": { "@type": "Organization", "name": "Intercoper", "url": "https://www.intercoper.com" },
    "subjectOf": "https://intercoper.com/portfolio/lasvegastour-com",
    "founder": {
      "@type": "Person",
      "@id": "https://intercoper.com/author/mario-dalo#person",
      "name": "Mario Dalo",
      "jobTitle": "Founder of Intercoper",
      "url": "https://intercoper.com/author/mario-dalo",
      "sameAs": [
        "https://orcid.org/0009-0003-7402-0338",
        "https://www.linkedin.com/in/mariodalo/",
        "https://mariodalo.com",
        "https://featured.com/p/mario-dalo-8288",
        "https://intercoper.com/author/mario-dalo"
      ]
    },
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Larrea 1280",
      "addressLocality": "Buenos Aires",
      "addressRegion": "CABA",
      "postalCode": "C1117",
      "addressCountry": "AR"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "email": "hello@lasvegastour.com",
      "contactType": "Customer Service",
      "availableLanguage": ["English", "Spanish"]
    },
    "knowsAbout": ["Las Vegas shows", "Grand Canyon tours", "Las Vegas helicopter tours", "Hoover Dam", "Day trips from Las Vegas"]
  };

  // Sin SearchAction: /search?q= da 404 (el buscador del sitio abre la plataforma de reservas).
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    "name": "LasVegasTour",
    "alternateName": ["Las Vegas Tour", "lasvegastour.com"],
    "url": "https://lasvegastour.com",
    "inLanguage": "en",
    "description": "Independent guide to Las Vegas shows and tours: which experiences are worth booking, where to sit, and how long the Grand Canyon day really is, from research on traveler reviews.",
    "publisher": { "@id": ORG_ID }
  };

  // WebPage: de que trata la home (la ciudad, desambiguada con Wikipedia y Wikidata Q23768,
  // verificado el 15 nov 2026), quien la firma y en que se basa (el dataset del research).
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://lasvegastour.com/#webpage",
    "url": "https://lasvegastour.com",
    "name": "Las Vegas shows and tours: what's worth booking",
    "inLanguage": "en",
    "isPartOf": { "@id": SITE_ID },
    "about": {
      "@type": "City",
      "name": "Las Vegas",
      "sameAs": ["https://en.wikipedia.org/wiki/Las_Vegas", "https://www.wikidata.org/wiki/Q23768"]
    },
    "author": {
      "@type": "Person",
      "@id": "https://intercoper.com/author/mario-dalo#person",
      "name": "Mario Dalo",
      "url": "https://intercoper.com/author/mario-dalo"
    },
    "publisher": { "@id": ORG_ID },
    "hasPart": { "@id": LIST_ID },
    "dateModified": CHECKED_ISO,
    "isBasedOn": `https://doi.org/${DATASET_DOI}`,
    "citation": ["https://lasvegastour.com/las-vegas-research", `https://doi.org/${DATASET_DOI}`],
    "primaryImageOfPage": { "@type": "ImageObject", "url": `${IMG.hero.src}?w=1600&auto=format`, "caption": IMG.hero.alt }
  };

  // ItemList con los tres tours que la pagina MUESTRA, en el mismo orden. Antes declaraba diez
  // que no coincidian con los visibles.
  const ordered = FEATURED.map((f) => tours.find((t) => t.slug === f.slug)).filter(Boolean) as FeaturedTour[]
  const featuredToursSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": LIST_ID,
    "name": "Las Vegas tours we would book first",
    "description": "One Las Vegas tour per big decision: the Grand Canyon by coach, a helicopter landing and the Sphere.",
    "numberOfItems": ordered.length,
    "itemListElement": ordered.map((tour, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": `https://lasvegastour.com/tour/${tour.slug}`,
      "name": tour.title.trim()
    }))
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": homeFaq().map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a }
    }))
  };

  return (
    <>
      {[organizationSchema, websiteSchema, webPageSchema, featuredToursSchema, faqSchema].map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}

      {/* Home ordenada por las decisiones del viaje (15 nov 2026). Salieron el mosaico y los
          destinos, que repetian las categorias de los chips; el carrusel de testimonios (citas
          sin fuente, como "Jason M., Dallas"); el banner; y la lista de tours con "5/5" escrito
          a mano, "Not specified" y "N/A people". */}
      <HomeHero />
      <TrustStrip />
      <Container>
        <AdviceBox />
        <Decisions />
        <FeaturedTours tours={tours} />
        <ResearchBlock />
        <PlanYourTrip />
        <HubChips />
        <HomeFaq />
        <GuidesLibrary />
      </Container>

      <Footer />
    </>
  )
}

export const runtime = 'nodejs'
