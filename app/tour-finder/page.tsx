// app/tour-finder/page.tsx
import { createClient } from '@sanity/client';
import TourFinder from '../components/TourFinder';
import Footer from '../components/Footer';
import RecommendedTours from '../components/blog/RecommendedTours';
import { getRecommendedTours } from '@/lib/getRecommendedTours';
import Container from '../components/Container';

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
});

export const metadata = {
  title: 'Las Vegas Tour Finder - Find Your Perfect Day Trip in 30 Seconds',
  description: 'Answer 4 simple questions and we will match you with the best Las Vegas tour or day trip based on your time, group, interests, and budget. Real prices and ratings.',
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



export default async function TourFinderPage() {
  const tours = await getTours();
  const recommendedTours = await getRecommendedTours();

  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Las Vegas Tour Finder",
    "url": "https://lasvegastour.com/tour-finder",
    "description": "Interactive tool to find the best Las Vegas tour or day trip based on your preferences: time available, group size, experience type and budget.",
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
        "name": "How far is the Grand Canyon from Las Vegas?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The West Rim is the closest, about 2 to 2.5 hours each way by road. The South Rim, the classic national park, is roughly 4.5 hours each way, so those day trips are long and some include a flight to shorten the travel time."
        }
      },
      {
        "@type": "Question",
        "name": "West Rim or South Rim - which should I choose?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Choose the West Rim if you have a single day and want the Skywalk or a helicopter landing, since it is closest to Vegas. Choose the South Rim for the iconic, deeper national park viewpoints if you are willing to trade a longer day or fly part of the way."
        }
      },
      {
        "@type": "Question",
        "name": "Are Grand Canyon helicopter tours worth it?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "It depends on whether the flight lands. Air-only flyovers are shorter and cheaper, while tours that descend below the rim and land on the canyon floor, sometimes with a champagne picnic or a Colorado River boat ride, cost more but are the most memorable."
        }
      },
      {
        "@type": "Question",
        "name": "Do I need to book Antelope Canyon tours in advance?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Antelope Canyon sits on Navajo land near Page, Arizona, requires a Navajo guide, and time slots sell out well ahead in peak season. Check whether the tour visits Lower or Upper Antelope, as access and difficulty differ."
        }
      },
      {
        "@type": "Question",
        "name": "What should I bring on a desert day trip?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Bring plenty of water, sun protection, a hat, and comfortable shoes. Desert temperatures swing widely, so layers help, and most tours include hotel pickup so you can travel light."
        }
      },
      {
        "@type": "Question",
        "name": "How do I book a Las Vegas tour?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Use the Tour Finder above to get matched with the right tour, then click Check Availability to book directly through the operator with free cancellation on most options."
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
            How the Las Vegas Tour Finder Works
          </h2>
          <p>
            Choosing the right day trip from Las Vegas can be overwhelming. Our Tour Finder asks four simple questions about your schedule, group, interests, and budget, then matches you with the best options from our database of verified tours.
          </p>
          <p>
            Every recommendation is backed by real data: prices, durations, and ratings tracked twice weekly. You compare actual numbers instead of guessing from marketing copy.
          </p>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '40px', marginBottom: '16px', color: '#202124' }}>
            Las Vegas Tour Types Explained
          </h2>
          <p>
            <strong>Grand Canyon West Rim tours</strong> are the closest Grand Canyon option, about 2 to 2.5 hours each way. The West Rim sits on Hualapai land and offers Eagle Point, Guano Point, and the optional glass Skywalk. It is the best pick when you only have a single day.
          </p>
          <p>
            <strong>Grand Canyon South Rim tours</strong> reach the classic national park viewpoints, such as Mather Point and Grand Canyon Village, with deeper canyon views. At roughly 4.5 hours each way these are long days, and some packages fly part of the route to save time.
          </p>
          <p>
            <strong>Grand Canyon helicopter tours</strong> range from air-only flyovers to flights that land on the canyon floor, sometimes with a champagne picnic or a Colorado River boat ride. The landing tours cost more but are the most dramatic way to see the canyon.
          </p>
          <p>
            <strong>Antelope Canyon &amp; Horseshoe Bend tours</strong> pair the glowing slot-canyon walls near Page, Arizona, with the Horseshoe Bend overlook. They require a Navajo guide and are usually a long day or an overnight, so check whether they visit Lower or Upper Antelope.
          </p>
          <p>
            <strong>Hoover Dam tours</strong> are among the shortest and most budget-friendly trips, often a half day. They cover the dam, the bypass bridge, and the engineering history, and pair well with other stops in a combo.
          </p>
          <p>
            <strong>Combo tours</strong> bundle two marquee sights, most often the Grand Canyon and Hoover Dam, into one day with a single hotel pickup. They save hours of driving and often cost less than booking each trip separately.
          </p>
          <p>
            <strong>Private &amp; small-group tours</strong> mean fewer people, flexible pacing, and personalized commentary, in a private vehicle or a small van instead of a 40-seat coach. They suit travelers who want schedule control without waiting at every stop.
          </p>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '40px', marginBottom: '16px', color: '#202124' }}>
            Frequently Asked Questions
          </h2>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>How far is the Grand Canyon from Las Vegas?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              The West Rim is the closest, about 2 to 2.5 hours each way by road. The South Rim, the classic national park, is roughly 4.5 hours each way, so those day trips are long and some include a flight to shorten the travel time.
            </p>
          </details>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>West Rim or South Rim - which should I choose?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              Choose the West Rim if you have a single day and want the Skywalk or a helicopter landing, since it is closest to Vegas. Choose the South Rim for the iconic, deeper national park viewpoints if you are willing to trade a longer day or fly part of the way.
            </p>
          </details>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>Are Grand Canyon helicopter tours worth it?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              It depends on whether the flight lands. Air-only flyovers are shorter and cheaper, while tours that descend below the rim and land on the canyon floor, sometimes with a champagne picnic or a Colorado River boat ride, cost more but are the most memorable.
            </p>
          </details>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>Do I need to book Antelope Canyon tours in advance?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              Yes. Antelope Canyon sits on Navajo land near Page, Arizona, requires a Navajo guide, and time slots sell out well ahead in peak season. Check whether the tour visits Lower or Upper Antelope, as access and difficulty differ.
            </p>
          </details>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>What should I bring on a desert day trip?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              Bring plenty of water, sun protection, a hat, and comfortable shoes. Desert temperatures swing widely, so layers help, and most tours include hotel pickup so you can travel light.
            </p>
          </details>

          <details style={{ marginBottom: '12px', borderBottom: '1px solid #e0e0e0', paddingBottom: '12px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', padding: '12px 0', fontSize: '1.05rem', color: '#202124' }}>How do I book a Las Vegas tour?</summary>
            <p style={{ marginTop: '8px', color: '#555', lineHeight: 1.7 }}>
              Use the Tour Finder above to get matched with the right tour, then click &quot;Check Availability&quot; to book directly through the operator with free cancellation on most options.
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