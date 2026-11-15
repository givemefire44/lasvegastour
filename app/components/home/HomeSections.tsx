// La home ordenada por las decisiones del viaje, no por el catalogo (15 nov 2026). Mismo
// esquema que ColosseumRoman (hero, franja de confianza, consejo, decisiones, tours elegidos,
// research, plan, preguntas, biblioteca), con una diferencia: aca no hay entrada oficial que
// comparar. El eje es que decision estas tomando, y la home orienta hacia la guia de cada
// vertical en vez de contestarlo todo.
//
// Toda cifra sale de una page publicada (pilares del research) y lleva su enlace. Precio, nota y
// reseñas de los tours se leen en vivo del feed. Todos los enlaces internos van a pages o hubs
// publicados (verificado contra Sanity el 15 nov 2026).

import Link from 'next/link';
import CitySearch from '../CitySearch';
import { IMG, sized, type HomeImage } from './homeImages';
import styles from './home.module.css';

export const DATASET_DOI = '10.5281/zenodo.24061279';
export const CHECKED_LABEL = '15 November 2026';

export type FeaturedTour = {
  slug: string;
  title: string;
  image?: string;
  imageAlt?: string;
  price?: number;
  currency?: string;
  duration?: string;
  rating?: number;
  reviewCount?: number;
};

// Uno por decision grande: el canyon en bus, el helicoptero, un show. El de mas reseñas con
// nota >= 4.6 en cada categoria (15 nov 2026), y SOLO despues de leer el "What's Included /
// Not Included" de cada ficha. Las lineas why/skip dicen lo que la ficha dice.
export const FEATURED: { slug: string; level: string; why: string; skip: string; priceNote?: string }[] = [
  {
    slug: 'grand-canyon-west-eagle-point-bus-tour-optional-upgrades',
    level: 'Grand Canyon by coach',
    why: 'A 10-to-11-hour day to Grand Canyon West with hotel pickup and about 3.5 hours at Eagle Point and Guano Point, plus a Hoover Dam photo stop.',
    skip: 'You want the Skywalk included: it is a paid upgrade, like lunch and the flights.',
    priceNote: 'Base fare. Skywalk, lunch and flights cost extra.',
  },
  {
    slug: 'grand-canyon-helicopter-landing-tour-from-las-vegas',
    level: 'Helicopter landing',
    why: 'About 45 minutes of flight each way over Lake Mead and Hoover Dam, a landing on a bluff inside the canyon, and back in 2.3 hours.',
    skip: 'You need hotel pickup (there is none) or can’t commit 3+ days ahead, when refunds stop.',
  },
  {
    slug: 'sphere-vegas-wizard-of-oz-immersive-experience',
    level: 'The Sphere',
    why: '75 minutes inside the Sphere: the 1939 film rebuilt across the wraparound screen, with seats that move. You pay for the venue as much as the film.',
    skip: 'You want a live stage show or free cancellation: this is a screen, and the ticket is non-refundable.',
  },
];

const ALT_GENERICO = /^(tour[\s_-]*image|image|img|photo|picture|foto|imagen|untitled|default)[\s_-]*\d*$/i;
function altUtil(alt: string | undefined, titulo: string) {
  const limpio = (alt || '').trim();
  return !limpio || ALT_GENERICO.test(limpio) ? titulo : limpio;
}

function money(price?: number, currency?: string) {
  if (typeof price !== 'number') return null;
  const sym = currency === 'EUR' ? '€' : '$';
  return `${sym}${Number.isInteger(price) ? price : price.toFixed(2)}`;
}

// Hero en collage (Mario, 15 nov 2026, como luxorguide.com): una foto grande a la izquierda
// y cuatro experiencias a la derecha, cada una hacia su hub o guia. La grande es el Strip de
// noche: en celular es la unica que se ve y con el helicoptero el texto tapaba el helicoptero.
const HERO_TILES = [
  { img: IMG.cirque, label: 'Cirque du Soleil', href: '/cirque-du-soleil-shows-las-vegas' },
  { img: IMG.sphereDay, label: 'The Sphere', href: '/sphere-las-vegas-shows' },
  { img: IMG.heliLanding, label: 'Helicopter landing', href: '/grand-canyon-helicopter-tours' },
  { img: IMG.westViewpoint, label: 'Grand Canyon West', href: '/grand-canyon-west-rim-tours' },
];

export function HomeHero() {
  return (
    <section className={`${styles.hero} ${styles.heroCollage}`}>
      <div className={styles.collage}>
        <Link href="/las-vegas-strip-night-helicopter-flight" className={`${styles.tile} ${styles.tileBig}`} tabIndex={-1}>
          <img
            src={sized(IMG.hero, 1400)}
            srcSet={`${sized(IMG.hero, 800)} 800w, ${sized(IMG.hero, 1400)} 1400w, ${sized(IMG.hero, 2000)} 2000w`}
            sizes="(max-width: 640px) 100vw, 50vw"
            alt={IMG.hero.alt}
            fetchPriority="high"
            width={2420}
            height={1414}
          />
          <span className={styles.tileLabel}>The Strip at night</span>
        </Link>
        <div className={styles.tileGrid}>
          {HERO_TILES.map((t) => (
            <Link key={t.label} href={t.href} className={styles.tile} tabIndex={-1}>
              <img src={sized(t.img, 800, 560)} alt={t.img.alt} width={800} height={560} />
              <span className={styles.tileLabel}>{t.label}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className={styles.heroInner}>
        <h1 className={styles.h1}>Las Vegas shows and tours: what&apos;s worth booking</h1>
        <p className={styles.answer}>
          Which shows are worth the ticket, where to sit, and which <strong>Grand Canyon trip</strong> is
          worth the long day, from traveler reviews and real booking details.
        </p>
        <div className={styles.search}>
          <CitySearch />
        </div>
        <a href="/tour-finder" className={styles.finder}>
          Not sure which tour? Find yours in 30 seconds →
        </a>
      </div>
    </section>
  );
}

// Cuatro cosas comprobables. El cron de precios corre lunes y jueves (update-prices.yml), por
// eso "twice a week" y no "daily". Los numeros del corpus son los de /las-vegas-research.
export function TrustStrip() {
  const items = [
    { k: 'Research corpus', v: '40,112 traveler items', href: '/las-vegas-research' },
    { k: 'Tour prices and ratings', v: 'Updated twice a week' },
    { k: 'Research dataset', v: 'On Zenodo, with DOI', href: `https://doi.org/${DATASET_DOI}` },
    { k: 'Booking fee', v: 'None: book with the platform' },
  ];
  return (
    <div className={styles.trust}>
      <div className={styles.trustInner}>
        <ul className={styles.trustList}>
          {items.map((i) => (
            <li key={i.k}>
              <span className={styles.trustK}>{i.k}</span>
              {i.href ? (
                i.href.startsWith('/') ? (
                  <Link href={i.href} className={styles.trustV}>{i.v}</Link>
                ) : (
                  <a href={i.href} target="_blank" rel="noopener" className={styles.trustV}>{i.v}</a>
                )
              ) : (
                <span className={styles.trustV}>{i.v}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// El consejo, con la forma del Quick Answer de la ficha. Sin nombrar plataformas ni sugerir que
// sus notas no sirven (Mario, 15 nov 2026): dice que hacer, con la cifra que lo respalda.
// Cada frase es un hallazgo publicado:
// - shows: /las-vegas-show-ratings-what-they-hide (Absinthe y O, 3.98, ~20% de 1-2 estrellas)
// - asientos: /las-vegas-show-seats-where-to-sit (O, balcon)
// - helicoptero: /las-vegas-helicopter-tour-ground-time (123 reseñas <=3: vuelo 19 = 15%,
//   cancelacion 38, asiento 28)
// - canyon: /grand-canyon-day-trip-from-las-vegas-how-long (West 10-12 h, South 14-15 h)
export function AdviceBox() {
  return (
    <section className={styles.advice} aria-labelledby="advice-h">
      <h2 id="advice-h" className={styles.adviceHead}>
        <span aria-hidden="true">💡</span> Our advice: what&apos;s worth paying for in Las Vegas?
      </h2>
      <div className={styles.adviceBody}>
        {/* Texto del revisor externo (15 nov 2026), en tres bloques cortos. */}
        <p>
          <strong>For shows, choose the experience, not just the rating.</strong> Two Strip shows can
          have the same average rating yet leave audiences with completely different impressions. And
          choose your seat carefully: at O, some balcony reviewers reported missing parts of the
          performance.
        </p>
        <p>
          <strong>For helicopter tours, look beyond the flight.</strong> Flight-related issues
          accounted for just 15% of the complaints in the low-rated reviews we analyzed. Cancellations
          and seat assignments caused more frustration. Check the rebooking policy and seating
          arrangements before paying.
        </p>
        <p>
          <strong>For Grand Canyon trips, think in hours, not miles.</strong> Travelers report 10–12
          hours for a West Rim coach tour and 14–15 hours for the South Rim. That difference can
          determine whether the experience is worth your day.
        </p>
        <p className={styles.adviceFacts}>
          From 40,112 traveler items across five platforms ·{' '}
          <Link href="/las-vegas-research">See the research</Link>
        </p>
      </div>
    </section>
  );
}

// Las decisiones grandes del viaje, cada una con para quien es, cuando no conviene y la guia
// que la resuelve. Los textos salen de esas guias.
export function Decisions() {
  const ways = [
    {
      icon: '🏜️',
      name: 'Which Grand Canyon rim?', img: IMG.skywalk,
      badge: 'West or South Rim',
      for: 'You want the canyon in one day from Las Vegas: the West Rim is closer, the South Rim is the postcard view and a much longer day.',
      skip: 'You don’t want most of your day on a bus: a helicopter or a closer day trip fits better.',
      cta: { href: '/grand-canyon-west-vs-south-rim-from-las-vegas', label: 'West vs South Rim' },
      extra: { href: '/grand-canyon-day-trip-from-las-vegas-how-long', label: 'How long the day really is' },
    },
    {
      icon: '🚁',
      name: 'Is a helicopter worth it?', img: IMG.helicopter,
      badge: 'Flyover or landing',
      for: 'You want the canyon’s scale or the Strip lit up from the air, and you have chosen between a flyover and a landing.',
      skip: 'Your dates have no slack: cancellations and rebooking drew more complaints than the flight itself.',
      cta: { href: '/las-vegas-helicopter-tours-which-worth-it', label: 'Which helicopter tour' },
      extra: { href: '/las-vegas-helicopter-tour-ground-time', label: 'What goes wrong on the ground' },
    },
    {
      icon: '🎭',
      name: 'Which show, and where to sit?', img: IMG.cirque,
      badge: 'Cirque, magic, Sphere',
      for: 'You are choosing a type of show (Cirque, a residency, magic, comedy, the Sphere) for your group and budget.',
      skip: 'You want a single number to decide: two shows can share the same average for very different reasons.',
      cta: { href: '/how-to-choose-las-vegas-shows', label: 'How to choose a show' },
      extra: { href: '/las-vegas-show-seats-where-to-sit', label: 'Where to sit' },
    },
    {
      icon: '🌵',
      name: 'A day trip that isn’t the canyon', img: IMG.hoover,
      badge: 'Under an hour away',
      for: 'You want desert scenery without a 10-hour day: Red Rock is under 30 minutes from the Strip, Valley of Fire about an hour.',
      skip: 'You won’t drive and want Valley of Fire: it is too far to count on a rideshare, so take a tour or rent a car.',
      cta: { href: '/red-rock-canyon-from-las-vegas', label: 'Red Rock Canyon' },
      extra: { href: '/hoover-dam-tour-from-las-vegas', label: 'Hoover Dam from Las Vegas' },
    },
  ];
  return (
    <section className={styles.section} aria-labelledby="ways-h">
      <h2 id="ways-h" className={styles.h2}>Which Las Vegas decision are you making?</h2>
      <p className={styles.lead}>The four choices that shape a Las Vegas trip. Each card says who it fits, when to skip it, and the guide that settles it.</p>
      <div className={styles.waysGrid}>
        {ways.map((x) => (
          <div key={x.name} className={styles.way}>
            <Link href={x.cta.href} className={styles.wayMedia} tabIndex={-1}>
              <img src={sized(x.img, 560, 320)} alt={x.img.alt} loading="lazy" width={560} height={320} />
              <span className={styles.wayPrice}>{x.badge}</span>
            </Link>
            <div className={styles.wayBody}>
              <h3 className={styles.h3}><span aria-hidden="true">{x.icon}</span> {x.name}</h3>
              <p><strong className={styles.forLabel}>For you if</strong> {x.for}</p>
              <p><strong className={styles.skipLabel}>Skip it if</strong> {x.skip}</p>
              <div className={styles.wayLinks}>
                <Link href={x.cta.href} className={styles.readMore}>{x.cta.label} →</Link>
                <Link href={x.extra.href} className={styles.factLink}>{x.extra.label}</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FeaturedTours({ tours }: { tours: FeaturedTour[] }) {
  const bySlug = new Map(tours.map((t) => [t.slug, t]));
  const items = FEATURED.map((f) => ({ ...f, tour: bySlug.get(f.slug) })).filter((x) => x.tour);
  if (items.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="featured-h">
      <div className={styles.sectionHead}>
        <h2 id="featured-h" className={styles.h2}>Las Vegas tours we would book first</h2>
        <Link href="/tours" className={styles.more}>All Las Vegas tours →</Link>
      </div>
      <p className={styles.lead}>One per big decision, each with a high rating backed by hundreds or thousands of reviews. We read what each listing includes, so every pick says who should skip it.</p>
      <div className={styles.tourGrid}>
        {items.map(({ slug, level, why, skip, priceNote, tour }) => (
          <article key={slug} className={styles.tourCard}>
            <Link href={`/tour/${slug}`} className={styles.tourMedia} tabIndex={-1}>
              {tour!.image ? (
                <img src={tour!.image} alt={altUtil(tour!.imageAlt, tour!.title.trim())} className={styles.tourImg} loading="lazy" width={640} height={480} />
              ) : null}
              <span className={styles.level}>{level}</span>
            </Link>
            <div className={styles.tourBody}>
              <h3 className={styles.h3}>
                <Link href={`/tour/${slug}`}>{tour!.title.trim()}</Link>
              </h3>
              <p className={styles.why}>{why}</p>
              <p className={styles.skipBox}><strong className={styles.skipLabel}>Skip it if</strong> {skip}</p>
              <p className={styles.meta}>
                {typeof tour!.rating === 'number' ? <><span className={styles.star} aria-hidden="true">★</span> {tour!.rating.toFixed(1)} ({tour!.reviewCount?.toLocaleString('en-US')} reviews)</> : null}
                {tour!.duration ? <> · {tour!.duration.trim()}</> : null}
              </p>
              <div className={styles.tourFoot}>
                {money(tour!.price, tour!.currency) ? (
                  <span className={styles.price}>
                    from {money(tour!.price, tour!.currency)}
                    {priceNote ? <span className={styles.priceNote}>{priceNote}</span> : null}
                  </span>
                ) : <span />}
                <Link href={`/tour/${slug}`} className={styles.btn}>See the tour</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className={styles.footnote}>
        Ratings, review counts and prices come from the booking platform&apos;s listing; &quot;from&quot; is the cheapest option. Tours are run by the operator and booked at its price; we add no fee. We may earn a commission when you book through our links, at no extra cost to you.
      </p>
    </section>
  );
}

// Las ocho categorias del catalogo, arriba en la home (Mario, 15 nov 2026). Estaban solo en
// /tours: la home, el header y el footer no les daban ni un enlace en el HTML del servidor.
// Nombre, descripcion y cantidad de tours se leen de Sanity en vivo (la cantidad no se escribe a
// mano). Las fotos son de la biblioteca, abiertas antes del alt: siete categorias no tienen
// imagen propia y /tours muestra la primera foto de algun tour (por ejemplo, un afiche).
export type HomeCategory = { slug: string; title: string; description?: string; count: number };

const CATEGORY_IMG: Record<string, HomeImage> = {
  'grand-canyon-tours': IMG.skywalkSunset,
  'helicopter-tours': IMG.helicopter,
  shows: IMG.sphere,
  'strip-tours': IMG.stripDusk,
  'day-trips': IMG.desertRoad,
  'hoover-dam-tours': IMG.hooverTowers,
  'adventure-tours': IMG.kayak,
  nightlife: IMG.hero,
};
// Orden: lo que mas se busca primero (canyon, helicopteros, shows), despues el resto.
const CATEGORY_ORDER = ['grand-canyon-tours', 'helicopter-tours', 'shows', 'strip-tours', 'day-trips', 'hoover-dam-tours', 'adventure-tours', 'nightlife'];

export function CategoryGrid({ categories }: { categories: HomeCategory[] }) {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const items = CATEGORY_ORDER.map((slug) => bySlug.get(slug)).filter(Boolean) as HomeCategory[];
  if (items.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="categories-h">
      <div className={styles.sectionHead}>
        <h2 id="categories-h" className={styles.h2}>Browse Las Vegas tours by category</h2>
        <Link href="/tours" className={styles.moreBtn}>All Las Vegas tours →</Link>
      </div>
      <div className={styles.areaGrid}>
        {items.map((c) => {
          const img = CATEGORY_IMG[c.slug] || IMG.hero;
          return (
            <Link key={c.slug} href={`/tours/${c.slug}`} className={styles.area}>
              <div className={styles.areaMedia}>
                <img src={sized(img, 520, 340)} alt={img.alt} loading="lazy" width={520} height={340} />
                <span className={styles.areaTag}>{c.count} {c.slug === 'shows' ? 'shows' : 'tours'}</span>
              </div>
              <div className={styles.areaBody}>
                <h3 className={styles.h3}>{c.title}</h3>
                {c.description ? <p className={styles.catDesc}>{c.description}</p> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function ResearchBlock() {
  // Cada tarjeta es un consejo con la cifra que lo respalda, tomada del pilar publicado.
  const studies = [
    { href: '/las-vegas-show-ratings-what-they-hide', stat: '3.98', statNote: 'two Strip shows, same average', title: 'Read what reviewers describe', text: 'In 3,755 reviews of eight attractions, Absinthe and O share the same average and the same share of unhappy viewers, for reasons that do not overlap. What reviewers describe is what tells them apart.' },
    { href: '/las-vegas-helicopter-tour-ground-time', stat: '15%', statNote: 'of complaints were the flight', title: 'Check the rebooking policy first', text: 'Of 123 low-rated reviews of two helicopter operators, the flight itself led 19. Cancellations led 38, the seat 28 and the time on the ground 21.' },
    { href: '/grand-canyon-day-trip-from-las-vegas-how-long', stat: '10–12 h', statNote: 'a West Rim day, timed by reviewers', title: 'Price the canyon in hours', text: 'Seventy reviews state how long their day took. A West Rim coach day sits at 10 to 12 hours; a South Rim day, two hours further each way, at 14 to 15.' },
  ];
  return (
    <section className={`${styles.section} ${styles.research}`} aria-labelledby="research-h">
      <div className={styles.sectionHead}>
        <h2 id="research-h" className={styles.h2}>What reading Las Vegas reviews taught us</h2>
        <Link href="/las-vegas-research" className={styles.more}>The Research Program →</Link>
      </div>
      <p className={styles.lead}>
        Our advice comes from 40,112 traveler items gathered from five independent platforms. We publish
        the method and the data; the dataset is archived on Zenodo with its own DOI.
      </p>
      <div className={styles.studyGrid}>
        {studies.map((s) => (
          <Link key={s.href} href={s.href} className={styles.study}>
            <span className={styles.stat}>{s.stat}</span>
            <span className={styles.statNote}>{s.statNote}</span>
            <h3 className={styles.h3}>{s.title}</h3>
            <p>{s.text}</p>
            <span className={styles.readMore}>See the data →</span>
          </Link>
        ))}
      </div>
      <p className={styles.byline}>
        Research and tour picks by the Intercoper Curator Team, led by{' '}
        <a href="https://www.intercoper.com/author/mario-dalo" target="_blank" rel="noopener">Mario Dalo</a>, founder of Intercoper ·{' '}
        <Link href="/las-vegas-research">How we work</Link> ·{' '}
        <a href={`https://doi.org/${DATASET_DOI}`} target="_blank" rel="noopener">Dataset on Zenodo ↗</a>
      </p>
    </section>
  );
}

export function PlanYourTrip() {
  const plans = [
    { icon: '💵', title: 'What the trip really costs', text: 'Budget the trip, not the hotel: resort fee, food, shows, tours and getting around.', href: '/how-much-las-vegas-trip-costs' },
    { icon: '🧾', title: 'Resort fees and hidden charges', text: 'What is mandatory, what is expected, and what you can push back on.', href: '/las-vegas-resort-fees-tipping-hidden-charges' },
    { icon: '🚐', title: 'Hotel pickup, explained', text: 'Where tours actually collect you, and why the trouble starts before boarding.', href: '/las-vegas-tour-pickup-and-meeting-point' },
    { icon: '🧭', title: 'First time in Las Vegas', text: 'The most expensive mistakes first-timers make, and how to avoid them.', href: '/most-expensive-first-timer-mistakes-las-vegas' },
  ];
  return (
    <section className={`${styles.section} ${styles.planPanel}`} aria-labelledby="plan-h">
      <h2 id="plan-h" className={styles.h2}>Plan your Las Vegas trip</h2>
      <div className={styles.planGrid}>
        {plans.map((p) => (
          <Link key={p.href} href={p.href} className={styles.plan}>
            <span className={styles.areaIcon} aria-hidden="true">{p.icon}</span>
            <h3 className={styles.h3}>{p.title}</h3>
            <p>{p.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

// Preguntas y respuestas con lo publicado en cada guia o pilar; la misma lista alimenta el
// FAQPage. Nada de dato vigente (precios de shows, horarios): eso no sale del corpus.
export function homeFaq() {
  return [
    {
      q: 'How long is a Grand Canyon day trip from Las Vegas?',
      a: 'Reviewers who timed it describe 10 to 12 hours for a West Rim coach day and 14 to 15 hours for a South Rim day, which is about two hours further each way.',
      link: { href: '/grand-canyon-day-trip-from-las-vegas-how-long', label: 'How long the day really is' },
    },
    {
      q: 'Grand Canyon West or South Rim from Las Vegas?',
      a: 'The West Rim is closer and fits a Vegas trip; the South Rim is the classic postcard view but a much longer day. The choice comes down to total hours, minutes at a viewpoint and the kind of place you want.',
      link: { href: '/grand-canyon-west-vs-south-rim-from-las-vegas', label: 'West vs South Rim compared' },
    },
    {
      q: 'How do I choose between Las Vegas shows?',
      a: 'Start with the type of show and who you are going with, then read what reviewers describe. In 3,755 reviews we read, Absinthe and O have the same 3.98 average and the same share of unhappy viewers, for reasons that do not overlap.',
      link: { href: '/how-to-choose-las-vegas-shows', label: 'How to choose a show' },
    },
    {
      q: 'What goes wrong on Las Vegas helicopter tours?',
      a: 'Rarely the flight. In 123 low-rated reviews of two operators, the aircraft, pilot or flight led 19 complaints; cancellations or rescheduling led 38, the seat 28 and the time on the ground 21.',
      link: { href: '/las-vegas-helicopter-tour-ground-time', label: 'Helicopter tours: what reviewers blame' },
    },
    {
      q: 'Does “hotel pickup” mean my hotel?',
      a: 'Not always. Of 132 reviews describing door-to-door collection, 51 were helicopter tours and 47 desert adventure tours, and only 26 Grand Canyon coach trips, even though coach trips were more than half of the reviews read. Check where pickup actually happens.',
      link: { href: '/las-vegas-tour-pickup-and-meeting-point', label: 'Hotel pickup, explained' },
    },
    {
      q: 'Is the Sphere worth going inside?',
      a: 'It depends on what you want. The exterior display is a spectacle you can photograph for free; the inside is what justifies the ticket if you want an immersive visual experience or a concert by an artist you love.',
      link: { href: '/sphere-las-vegas-seats-tickets-guide', label: 'Sphere seats and tickets' },
    },
  ];
}

export function HomeFaq() {
  const faq = homeFaq();
  return (
    <section className={styles.section} aria-labelledby="faq-h">
      <h2 id="faq-h" className={styles.h2}>Las Vegas questions, answered</h2>
      <div className={styles.faqList}>
        {faq.map((f) => (
          <div key={f.q} className={styles.faqItem}>
            <h3 className={styles.h3}>{f.q}</h3>
            <p>{f.a}</p>
            <Link href={f.link.href} className={styles.readMore}>{f.link.label} →</Link>
          </div>
        ))}
      </div>
      <p className={styles.footnote}>
        Answers from our published guides and research, checked {CHECKED_LABEL}.
      </p>
    </section>
  );
}

export function GuidesLibrary() {
  const groups = [
    {
      title: 'Grand Canyon and day trips',
      links: [
        ['/is-the-grand-canyon-day-trip-from-las-vegas-worth-it', 'Is the Grand Canyon day trip worth it'],
        ['/grand-canyon-west-skywalk-eagle-point-guano-point', 'Skywalk, Eagle Point and Guano Point'],
        ['/grand-canyon-skywalk-tickets-price-phone-rule', 'Skywalk tickets and the phone rule'],
        ['/antelope-canyon-tour-from-las-vegas-what-reviews-say', 'Antelope Canyon from Las Vegas'],
        ['/valley-of-fire-from-las-vegas', 'Valley of Fire'],
        ['/zion-national-park-from-las-vegas', 'Zion National Park'],
      ],
    },
    {
      title: 'Helicopters and flights',
      links: [
        ['/las-vegas-strip-night-helicopter-flight', 'Strip night helicopter flight'],
        ['/are-las-vegas-grand-canyon-helicopter-tours-safe', 'Are helicopter tours safe'],
        ['/las-vegas-helicopter-seat-assignment', 'How seats are assigned'],
        ['/las-vegas-helicopter-tour-nervous-flyers', 'For nervous flyers'],
        ['/grand-canyon-airplane-tour-from-las-vegas', 'Grand Canyon by airplane'],
        ['/las-vegas-helicopter-cancellation-rebooking', 'Cancellations and rebooking'],
      ],
    },
    {
      title: 'Shows and the Strip',
      links: [
        ['/sphere-las-vegas-seats-tickets-guide', 'Sphere seats and tickets'],
        ['/wizard-of-oz-at-sphere-how-long-tickets-seats', 'The Wizard of Oz at Sphere'],
        ['/las-vegas-shows-with-kids', 'Shows with kids'],
        ['/how-long-are-las-vegas-shows', 'How long shows last'],
        ['/fremont-street-experience-what-reviews-say', 'Fremont Street Experience'],
        ['/high-roller-las-vegas-tickets-hours-happy-half-hour', 'High Roller'],
      ],
    },
    {
      title: 'Plan and book',
      links: [
        ['/first-time-las-vegas-how-to-plan', 'First time in Las Vegas'],
        ['/how-to-get-around-las-vegas', 'How to get around'],
        ['/how-to-book-a-las-vegas-tour-without-getting-burned', 'Book a tour without getting burned'],
        ['/las-vegas-day-tours-with-kids', 'Day tours with kids'],
        ['/what-to-bring-las-vegas-tour', 'What to bring on a tour'],
        ['/las-vegas-casino-gambling-responsibly', 'Gambling responsibly'],
      ],
    },
  ];
  return (
    <section className={styles.section} aria-labelledby="library-h">
      <div className={styles.sectionHead}>
        <h2 id="library-h" className={styles.h2}>The Las Vegas guides library</h2>
        {/* La biblioteca completa merece boton, arriba y al cierre (Mario, 15 nov 2026). */}
        <Link href="/las-vegas-guides" className={styles.moreBtn}>Every guide →</Link>
      </div>
      <div className={styles.libraryGrid}>
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className={styles.libTitle}>{g.title}</h3>
            <ul className={styles.libList}>
              {g.links.map(([href, label]) => (
                <li key={href}><Link href={href}>{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={styles.libraryCta}>
        <Link href="/las-vegas-guides" className={styles.ctaBtn}>Browse all Las Vegas guides →</Link>
      </div>
    </section>
  );
}
