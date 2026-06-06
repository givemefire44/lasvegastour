// app/tour-finder/page.tsx
import { createClient } from '@sanity/client';
import TourFinder from '../components/TourFinder';
import Footer from '../components/Footer';
import RecommendedTours from '../components/blog/RecommendedTours';
import Container from '../components/Container';

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
});

export const metadata = {
  title: 'Vatican Tour Finder — Find Your Perfect Tour in 30 Seconds',
  description: 'Answer 4 simple questions and we will match you with the best Vatican tour based on your time, group, interests, and budget. Real prices and ratings.',
  alternates: {
    canonical: 'https://lasvegastour.com/tour-finder',
  },
};

async function getTours() {
  return await client.fetch(`
   *[_type == "post" && defined(tourInfo.price) && defined(getYourGuideUrl) && discontinued != true && !(_id in path("drafts.**"))] | order(getYourGuideData.reviewCount desc) {
      title,
      "slug": slug.current,
      "price": tourInfo.price,
      "duration": tourInfo.duration,
      "rating": getYourGuideData.rating,
      "reviewCount": getYourGuideData.reviewCount,
      "gygUrl": getYourGuideUrl,
      "provider": getYourGuideData.provider,
     "image": heroGallery[0].asset->url
    }
  `);
}

async function getRecommendedTours() {
  return await client.fetch(`
    *[_type == "post" && defined(tourInfo.price) && discontinued != true && !(_id in path("drafts.**"))] | order(getYourGuideData.reviewCount desc) [0..7] {
      _id,
      title,
      slug,
      mainImage{
        asset->{
          _id,
          url,
          metadata {
            dimensions {
              width,
              height
            }
          }
        },
        alt
      },
      heroGallery[0...3]{
        asset->{
          _id,
          url,
          metadata {
            dimensions {
              width,
              height
            }
          }
        },
        alt
      },
      body[0...2]
    }
  `);
}

export default async function TourFinderPage() {
  const tours = await getTours();
  const recommendedTours = await getRecommendedTours();

  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Vatican Tour Finder",
    "url": "https://lasvegastour.com/tour-finder",
    "description": "Interactive tool to find the best Vatican tour based on your preferences: time available, group size, experience type and budget.",
    "applicationCategory": "TravelApplication",
    "operatingSystem": "Any",
    "featureList": "Real-time tour filtering, price comparison, personalized recommendations based on time, group size, experience type and budget",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Organization",
      "@id": "https://intercoper.com/#organization",
      "name": "Intercoper"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Do I need to book Vatican tours in advance?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. The Vatican Museums use timed-entry reservations and routinely sell out weeks ahead, especially from March to October. A skip-the-line tour guarantees a reserved entry slot so you avoid the main ticket queue."
        }
      },
      {
        "@type": "Question",
        "name": "Can I take photos in the Sistine Chapel?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Photography is strictly prohibited in the Sistine Chapel and silence is enforced. Photos without flash are allowed in the rest of the Vatican Museums."
        }
      },
      {
        "@type": "Question",
        "name": "Is the St. Peter's Dome climb worth it?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The dome climb is 551 steps total, or an elevator to the roof followed by 320 steps, and rewards you with panoramic views over St. Peter's Square and Rome. It requires a separate ticket and is not wheelchair accessible, so it suits visitors comfortable with stairs."
        }
      },
      {
        "@type": "Question",
        "name": "Are Vatican and Colosseum combo tours a good idea?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "They work well for visitors with limited time who want Rome's two top sites in one day. They are the longest tours, so check the duration, rating, and review count before booking, and be aware that full-day packages with hotel pickup can feel rushed."
        }
      },
      {
        "@type": "Question",
        "name": "How does the Vatican Tour Finder choose which tours to recommend?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The Tour Finder filters active Vatican tours based on your answers: time available, group type, experience preference, and budget. Results are sorted by a combination of verified rating and value."
        }
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />
      <TourFinder tours={tours} />

      <Container>
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
          padding: '0 0 60px 0',
          color: '#333',
          lineHeight: 1.7,
          fontSize: '1.05rem',
        }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '16px', color: '#202124' }}>
            How the Vatican Tour Finder Works
          </h2>
          <p>
            Choosing the right Vatican tour can be overwhelming. Our Tour Finder asks four simple questions about your schedule, group, interests, and budget, then matches you with the best options from our database of verified tours.
          </p>
          <p>
            Every recommendation is backed by real data: prices, durations, and ratings tracked twice weekly from GetYourGuide. You compare actual numbers instead of guessing from marketing copy.
          </p>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '40px', marginBottom: '16px', color: '#202124' }}>
            Vatican Tour Types Explained
          </h2>
          <p>
            <strong>Standard Vatican tours</strong> cover the Vatican Museums, the Sistine Chapel, and usually St. Peter&apos;s Basilica. They typically last around 3 hours and offer the best value for first-time visitors who want the major highlights with a guide.
          </p>
          <p>
            <strong>Skip-the-line tours</strong> include a reserved, timed entry that bypasses the main Vatican Museums ticket queue, which can exceed an hour in peak season. This is the single biggest time-saver during the March-October crowds.
          </p>
          <p>
            <strong>Early-entry tours</strong> get you into the Museums before general admission. The Sistine Chapel is dramatically quieter in the first 30-60 minutes, which is the only realistic window to study Michelangelo&apos;s ceiling without large crowds.
          </p>
          <p>
            <strong>St. Peter&apos;s Basilica &amp; Dome climb tours</strong> focus on the basilica, Michelangelo&apos;s Pieta, and Bernini&apos;s baldachin, with the optional 551-step cupola climb for panoramic views over Rome. The dome requires a separate ticket and is not wheelchair accessible.
          </p>
          <p>
            <strong>Vatican + Colosseum combo tours</strong> cover Rome&apos;s two top sites in a single day. They are the longest tours (typically 6-10 hours) and work best for visitors with limited time who want to tick off both landmarks efficiently.
          </p>
          <p>
            <strong>Private &amp; small-group tours</strong> mean fewer people, flexible pacing, and personalized commentary. On guided tours, you can often pass directly from the Sistine Chapel into St. Peter&apos;s Basilica through a private connecting door, skipping the basilica&apos;s separate security queue.
          </p>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '40px', marginBottom: '16px', color: '#202124' }}>
            Frequently Asked Questions
          </h2>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>Do I need to book Vatican tours in advance?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              Yes. The Vatican Museums use timed-entry reservations and routinely sell out weeks ahead, especially from March to October. A skip-the-line tour guarantees a reserved entry slot so you avoid the main ticket queue.
            </p>
          </details>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>Can I take photos in the Sistine Chapel?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              No. Photography is strictly prohibited in the Sistine Chapel and silence is enforced. Photos without flash are allowed in the rest of the Vatican Museums.
            </p>
          </details>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>Is the St. Peter&apos;s Dome climb worth it?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              The dome climb is 551 steps total, or an elevator to the roof followed by 320 steps, and rewards you with panoramic views over St. Peter&apos;s Square and Rome. It requires a separate ticket and is not wheelchair accessible, so it suits visitors comfortable with stairs.
            </p>
          </details>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>Are Vatican + Colosseum combo tours a good idea?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              They work well for visitors with limited time who want Rome&apos;s two top sites in one day. They are the longest tours, so check the duration, rating, and review count before booking, and be aware that full-day packages with hotel pickup can feel rushed.
            </p>
          </details>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>What is the dress code for the Vatican?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              Shoulders and knees must be covered for both the Vatican Museums and St. Peter&apos;s Basilica. Tank tops, shorts, and short skirts are not permitted, and the rule is strictly enforced at the entrance.
            </p>
          </details>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>How do I book a Vatican tour?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              Use the Tour Finder above to get matched with the right tour, then click &quot;Check Availability&quot; to book directly through GetYourGuide with free cancellation on most options.
            </p>
          </details>
        </div>
      </Container>

      <Container>
        <RecommendedTours tours={recommendedTours} />
      </Container>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}