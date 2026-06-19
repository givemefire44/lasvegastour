// set-category-content.mjs
// Carga seoTitle, seoDescription, description y faqs (evergreen) en las 8 categorias de lasvegastour.
// NO toca longDescription (decision: schema-only sin visual = riesgo Google).
// Contenido EVERGREEN: sin precios/ratings/review-counts (los actualiza el cron solo en los tours).
//
// Uso:
//   node set-category-content.mjs --dry-run     (muestra que haria, NO escribe)
//   node set-category-content.mjs               (escribe en Sanity)
//   node set-category-content.mjs --slug=shows  (una sola categoria)
//
// IMPORTANTE: projectId esta HARDCODED a 'kabmqky1' (lasvegastour) para no depender
// de SANITY_PROJECT_ID del entorno. El token DEBE ser de lasvegastour con permiso de
// escritura (el mismo SANITY_TOKEN que usa cron-prices.mjs para actualizar precios aca).

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import { randomBytes } from 'crypto';

const DRY = process.argv.includes('--dry-run');
const slugArg = (process.argv.find(a => a.startsWith('--slug=')) || '').split('=')[1] || null;

const sanity = createClient({
  projectId: 'kabmqky1',
  dataset: 'production',
  token: process.env.SANITY_API_TOKEN || process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

const key = () => randomBytes(6).toString('hex');

const CATEGORIES = [
  {
    slug: 'adventure-tours',
    seoTitle: 'Las Vegas Adventure Tours | ATV, Kayak & Horseback',
    seoDescription: 'Book Las Vegas ATV rides, Emerald Cave kayak trips, and horseback adventures. Reviewed, compared, and selected for every skill level and budget.',
    description: 'ATV dune rides, Emerald Cave kayak trips, and desert horseback adventures — most under half a day.',
    faqs: [
      { question: 'How much do Las Vegas adventure tours cost?', answer: 'Adventure tour prices in Las Vegas depend on the activity, the length, and whether hotel pickup is included. Short ATV rides and beginner sessions are the most affordable, while longer desert adventures and horseback rides with meals cost more. Each tour shows its current price, so comparing a few side by side is the easiest way to match your budget.' },
      { question: 'What outdoor activities can you do near Las Vegas?', answer: 'The most popular are ATV and UTV rides through Nellis Dunes and the Mojave Desert, kayaking to Emerald Cave on the Colorado River, and horseback riding in Red Rock Canyon or on working ranches. Most are doable as half-day trips with hotel pickup. They\u2019re a popular break from the Strip without needing a long day trip.' },
      { question: 'Do I need experience for a Las Vegas ATV tour?', answer: 'No. Many ATV tours are beginner-friendly and include training before you ride. Guides lead the route and adjust the pace to the group. You\u2019ll need a valid driver\u2019s license to operate your own vehicle on most tours.' },
      { question: 'Is the Emerald Cave kayak tour worth it?', answer: 'The Emerald Cave kayak trip is one of the most popular outdoor tours from Las Vegas. You paddle a calm stretch of the Colorado River in Black Canyon to a cave that glows emerald green at midday. Trips typically run a half day and most include hotel pickup.' },
      { question: 'How long are Las Vegas adventure tours?', answer: 'Most run between 1 and 6 hours. Quick ATV rides and beginner sessions take 1\u20132 hours, while kayak trips and horseback rides with meals run longer. That makes most of them half-day activities, leaving time for the Strip the same evening.' },
      { question: 'When is the best time for outdoor tours in Las Vegas?', answer: 'Spring and fall offer the most comfortable temperatures for desert activities. In summer, morning departures are best to avoid the midday heat, and most operators provide water. Winter is mild and good for ATV and horseback rides, though mornings can be cold.' },
    ],
  },
  {
    slug: 'day-trips',
    seoTitle: 'Las Vegas Day Trips | Antelope Canyon, Zion & More',
    seoDescription: 'Day trips from Las Vegas to Antelope Canyon, Valley of Fire, Zion, Bryce, and Red Rock. Reviewed and compared for the best small-group tours.',
    description: 'Antelope Canyon, Valley of Fire, Zion, Bryce, and Red Rock — small-group day trips for every distance and budget.',
    faqs: [
      { question: 'What are the best day trips from Las Vegas?', answer: 'The most popular day trips are Antelope Canyon with Horseshoe Bend, Valley of Fire State Park, Zion and Bryce national parks, and Red Rock Canyon. Red Rock is the closest at under an hour away, while Antelope Canyon and the Utah parks are full-day trips. Most run as small-group tours with hotel pickup.' },
      { question: 'How much do day trips from Las Vegas cost?', answer: 'Day-trip prices depend mainly on distance and how long you\u2019re out. Closer half-day trips like Red Rock Canyon are the most affordable, while full-day trips to Antelope Canyon or two-park combos cost more, partly because of the distance and included meals. Each tour lists its current price, so comparing a few is the best way to plan your budget.' },
      { question: 'Is Antelope Canyon worth the day trip from Las Vegas?', answer: 'Antelope Canyon is one of the most photographed slot canyons in the Southwest, and tours pair it with nearby Horseshoe Bend. It\u2019s a long day \u2014 around 14\u201315 hours round trip \u2014 but consistently one of the highest-rated trips from Vegas. If you want dramatic scenery and don\u2019t mind an early start, it\u2019s among the most rewarding.' },
      { question: 'How far is Valley of Fire from Las Vegas?', answer: 'Valley of Fire is about an hour northeast of Las Vegas, making it one of the closest state parks. Small-group tours run around 6 hours. Its bright red sandstone formations and ancient petroglyphs make it a popular shorter alternative to the longer canyon trips.' },
      { question: 'Can you visit Zion and Bryce in one day from Las Vegas?', answer: 'Yes. Two-park combo tours visit both Zion and Bryce Canyon in a single day, typically running about 13 hours round trip. It\u2019s a long day with a lot of driving, but it lets you see two very different national parks without an overnight stay.' },
      { question: 'Which day trip is best if I\u2019m short on time?', answer: 'Red Rock Canyon is the best option for a shorter day \u2014 it\u2019s under an hour from the Strip, with hiking, e-bike, and scooter tours that run about 4 hours. You can be back in Las Vegas by afternoon. Valley of Fire is the next step up at around 6 hours.' },
    ],
  },
  {
    slug: 'grand-canyon-tours',
    seoTitle: 'Grand Canyon Tours from Las Vegas | Best Day Trips',
    seoDescription: 'Compare the best Grand Canyon tours from Las Vegas — South Rim day trips, West Rim Skywalk, and helicopter flights. Reviewed, compared, and selected.',
    description: 'Day trips to the West Rim, South Rim, and Skywalk — from budget bus tours to luxury coach and helicopter flights.',
    faqs: [
      { question: 'How much does a Grand Canyon tour from Las Vegas cost?', answer: 'Grand Canyon tour prices depend mainly on the rim you visit, the transport (bus, luxury coach, or air), and whether meals and the Skywalk are included. West Rim bus day trips are the most affordable, while South Rim trips, helicopter flights, and multi-canyon adventures cost more. Each tour lists its current price, so comparing a few side by side is the best way to find your budget.' },
      { question: 'What\u2019s the difference between the West Rim and the South Rim?', answer: 'The West Rim is closer to Las Vegas (about a 2.5-hour drive), home to the Skywalk and Eagle Point, and the most popular choice for day trips at around 10\u201311 hours round trip. The South Rim is the classic Grand Canyon National Park view \u2014 farther away and a longer day, typically 13\u201316 hours, but with the most iconic panoramas. If it\u2019s your first visit and time is tight, the West Rim is the easier pick.' },
      { question: 'Is the Grand Canyon Skywalk worth it?', answer: 'The Skywalk is a glass-bottomed bridge at the West Rim\u2019s Eagle Point that puts you 4,000 feet above the canyon floor. It\u2019s an optional add-on to most West Rim tours and appeals to visitors who want the thrill and the photo. If you\u2019re afraid of heights or watching your budget, the standard West Rim viewpoints are spectacular on their own.' },
      { question: 'How long is a Grand Canyon day trip from Vegas?', answer: 'A West Rim bus tour typically runs 10 to 12 hours round trip, including travel, stops, and time at the canyon. South Rim trips are longer, usually 13 to 16 hours because of the greater distance. Helicopter tours are the fastest option, taking only a few hours total.' },
      { question: 'Can you visit the Grand Canyon and Hoover Dam in one day?', answer: 'Yes. Many West Rim tours include a stop at the Hoover Dam on the way, since it sits right along the route from Las Vegas. Combo tours pair both landmarks in a single day of around 10\u201311 hours. It\u2019s one of the most efficient ways to see two of the area\u2019s biggest sights at once.' },
      { question: 'Which Grand Canyon tour from Las Vegas is the best?', answer: 'The most-booked option is the Grand Canyon West Eagle Point bus tour, which balances price, convenience, and the West Rim\u2019s main viewpoints. For a more premium experience, VIP coaches and luxury tours add smaller groups and meals. The best choice depends on your budget and whether you prefer the closer West Rim or the classic South Rim.' },
    ],
  },
  {
    slug: 'helicopter-tours',
    seoTitle: 'Las Vegas Helicopter Tours | Strip & Grand Canyon',
    seoDescription: 'Las Vegas helicopter tours — night flights over the Strip and Grand Canyon landing tours. Reviewed and compared for the best aerial views.',
    description: 'Night flights over the Strip and Grand Canyon landing tours — views you can\u2019t get from the ground.',
    faqs: [
      { question: 'How much is a helicopter tour in Las Vegas?', answer: 'Helicopter tour prices depend on where you fly. Short Strip night flights are the most affordable option, while Grand Canyon helicopter tours cost more because they fly farther and often land in the canyon. Sunset flights and tours with a Colorado River add-on sit at the top end. Each tour lists its current price.' },
      { question: 'Do Las Vegas helicopter tours fly over the Strip?', answer: 'Yes. Strip night flights are the most affordable helicopter option, taking you over the lights of the Las Vegas Strip for about 10\u201315 minutes. Some Grand Canyon sunset tours also include a Strip flyover on the way back. They\u2019re popular for couples and special occasions.' },
      { question: 'Can you land in the Grand Canyon by helicopter?', answer: 'Yes. Several West Rim helicopter tours land on the canyon floor, often near the Colorado River. Air-only tours that fly over the rim without landing are cheaper. Landing tours run longer \u2014 typically a half day round trip from Las Vegas.' },
      { question: 'Is a Grand Canyon helicopter tour worth it?', answer: 'A Grand Canyon helicopter tour gives you aerial views of the canyon you can\u2019t get any other way, and floor-landing flights add the experience of standing at the bottom. It\u2019s a splurge, but for a once-in-a-lifetime trip many travelers consider it the highlight of their visit.' },
      { question: 'How long are Las Vegas helicopter tours?', answer: 'Strip night flights are the shortest, around 1\u20132 hours including transfers for a 10\u201315 minute flight. Grand Canyon helicopter tours run a half day, and combo tours with a plane or Colorado River add-on can take most of a day. Most include hotel pickup and drop-off.' },
      { question: 'What\u2019s the best time for a Las Vegas helicopter tour?', answer: 'Strip flights are best at night, when the lights are at their brightest. Grand Canyon flights are stunning at sunset, though daytime flights offer the clearest canyon detail. Booking ahead is recommended, as popular sunset slots fill quickly.' },
    ],
  },
  {
    slug: 'hoover-dam-tours',
    seoTitle: 'Hoover Dam Tours from Las Vegas | Interior & More',
    seoDescription: 'Hoover Dam tours from Las Vegas — interior access, the generator room, and bridge walks. Reviewed and compared for the best small-group trips.',
    description: 'Interior access, the generator room, and bridge walks — small-group Hoover Dam trips, most a half day.',
    faqs: [
      { question: 'How much does a Hoover Dam tour from Las Vegas cost?', answer: 'Hoover Dam tour prices depend on how much access and how many stops are included. Quick mini tours and viewpoint trips are the most affordable, while tours that add the generator room, a bridge walk, or extra stops cost more. Each tour lists its current price, so comparing a few is the easiest way to choose.' },
      { question: 'Can you go inside the Hoover Dam?', answer: 'Yes. Several tours include interior access, taking you down to the power plant and generator room. The VIP interior tour is one of the most booked options. Without a tour, interior access requires booking the dam\u2019s own tour on site.' },
      { question: 'How far is the Hoover Dam from Las Vegas?', answer: 'The Hoover Dam is about 45 minutes southeast of Las Vegas, near Boulder City. That makes it one of the closest attractions and an easy half-day trip. Many tours pair it with the bridge walk or other nearby stops since it\u2019s so close.' },
      { question: 'How long is a Hoover Dam tour?', answer: 'Most Hoover Dam tours run 3 to 7 hours. A short mini tour covers the highlights, while interior, generator-room, and combo tours take longer. The short distance from Las Vegas means you can easily do one in a morning or afternoon.' },
      { question: 'Is the Hoover Dam interior tour worth it?', answer: 'The interior tour takes you below the dam to the generator room and power plant, areas you can\u2019t see from the viewing platforms. If you\u2019re interested in how the dam works rather than just the views, the interior access is what makes it worth booking.' },
      { question: 'What\u2019s included in a Hoover Dam tour?', answer: 'Most include round-trip transport from Las Vegas and a guide; interior tours add power-plant and generator-room access. Combo tours bundle the bridge walk, Boulder City, or nearby stops. Check whether interior access is included, as some cheaper tours only stop at the viewpoints.' },
    ],
  },
  {
    slug: 'nightlife',
    seoTitle: 'Las Vegas Nightlife Tours | Club & Bar Crawls',
    seoDescription: 'Las Vegas club crawls, pool parties, and bar crawls — VIP entry and party bus transport between venues. Reviewed and compared.',
    description: 'VIP club crawls, pool parties, and Fremont bar crawls — express entry and party bus between venues.',
    faqs: [
      { question: 'How much do Las Vegas club crawls cost?', answer: 'Club and bar crawl prices depend on how many venues are included and whether transport is private. Standard group crawls with express entry and a shared party bus are the most affordable, while private party bus experiences cost more. Each tour lists its current price.' },
      { question: 'What\u2019s included in a Las Vegas club crawl?', answer: 'A typical club crawl includes express or skip-the-line entry to several venues, a party bus between them, and a host or guide. Some include a welcome drink or shot. Drinks at the venues are usually extra unless stated.' },
      { question: 'What\u2019s the difference between a club crawl and a pool crawl?', answer: 'Club crawls happen at night and visit nightclubs, while pool crawls run during the day at Las Vegas dayclubs. Both use party bus transport and express entry. Pool crawls are seasonal, busiest in the warmer months.' },
      { question: 'Are Las Vegas bar crawls good for groups?', answer: 'Yes \u2014 crawls are one of the most popular group activities in Vegas, especially for bachelor and bachelorette parties. The party bus keeps the group together and skips the cover-charge lines. Fremont Street bar crawls are a more relaxed, downtown alternative to Strip nightclubs.' },
      { question: 'Do you skip the line on a Las Vegas club crawl?', answer: 'Most club crawls include express entry, letting you skip the general-admission line at each venue. This is one of the main reasons people book them, since club lines can be long on weekends. Confirm \u201cexpress entry\u201d or \u201cskip-the-line\u201d is listed when booking.' },
      { question: 'How long do Las Vegas nightlife tours last?', answer: 'Most club and bar crawls run 3 to 5 hours, visiting two to four venues. Private party bus experiences can be shorter. The party bus time between venues is part of the experience, with music and a host.' },
    ],
  },
  {
    slug: 'shows',
    seoTitle: 'Las Vegas Show Tickets | Cirque, Magic & Variety',
    seoDescription: 'Book Las Vegas show tickets — Cirque du Soleil, magic, mentalists, and variety shows. Reviewed and compared to find the best seats.',
    description: 'Cirque du Soleil, magic, mentalists, and variety shows — most around 90 minutes.',
    faqs: [
      { question: 'How much are Las Vegas show tickets?', answer: 'Show ticket prices depend on the production and your seat. Magic, mentalist, and variety shows are generally the most affordable, while Cirque du Soleil productions cost more. Booking ahead usually gets better seats and prices than buying same-day, and each show lists its current pricing.' },
      { question: 'Which Cirque du Soleil show in Las Vegas is the best?', answer: 'Each Cirque show has a different theme: O at Bellagio is known for its aquatic stage, K\u00c0 at MGM Grand for its epic scale, Myst\u00e8re for being the original, and Michael Jackson ONE for the music. O and Michael Jackson ONE are among the most booked. The best choice depends on whether you want acrobatics, story, or a music-driven show.' },
      { question: 'How long are Las Vegas shows?', answer: 'Most Las Vegas shows run about 75 to 90 minutes. Cirque du Soleil productions are typically 90 minutes, while magic and variety shows often run a bit shorter. Most don\u2019t have an intermission, so plan dinner accordingly.' },
      { question: 'Are magic shows in Las Vegas worth it?', answer: 'Las Vegas magic and mentalist shows are among the highest-rated entertainment in the city, and generally cost less than the big Cirque productions. They tend to be more intimate and interactive. For value and a close-up experience, they\u2019re a strong pick.' },
      { question: 'Do I need to book Las Vegas show tickets in advance?', answer: 'Booking ahead is recommended, especially for Cirque du Soleil and weekend dates, which sell out. Advance tickets usually mean better seat choice and pricing. Smaller magic and variety shows have more same-day availability but still fill up in peak season.' },
      { question: 'What\u2019s the cheapest Las Vegas show?', answer: 'Variety, magic, and mentalist shows are generally the most affordable, like the V Ultimate Variety Show and several mind-reading acts. They deliver a full Vegas show experience for less than the big productions. They\u2019re a good option if you want to see more than one show on a trip.' },
    ],
  },
  {
    slug: 'strip-tours',
    seoTitle: 'Things to Do on the Las Vegas Strip | City Tours',
    seoDescription: 'Las Vegas Strip and city tours — the High Roller, supercar driving, food tours, and walking tours. Reviewed and compared for every budget.',
    description: 'The High Roller, supercar driving, food tours, and Strip walks — experiences for every budget.',
    faqs: [
      { question: 'What are the best things to do on the Las Vegas Strip?', answer: 'Popular Strip experiences include riding the High Roller observation wheel, supercar track drives, guided food tours, the ARTE digital art museum, and thrill rides like the Big Apple Coaster. Walking tours of Fremont Street downtown are also popular. There\u2019s a wide range, so many fit easily between other plans.' },
      { question: 'How much do Las Vegas Strip tours and attractions cost?', answer: 'Prices range widely, from quick low-cost attractions like the High Roller and Big Apple Coaster up to premium supercar track experiences. Food and walking tours sit in the middle. The variety means you can find something at almost any budget, and each option lists its current price.' },
      { question: 'Is the High Roller worth it?', answer: 'The High Roller is the tallest observation wheel on the Strip, and a 30-minute rotation is one of the most affordable views in the city. It\u2019s especially popular at sunset and after dark. For the price, it\u2019s an easy add to any Strip itinerary.' },
      { question: 'Are Las Vegas food tours worth it?', answer: 'Las Vegas food tours are highly rated and walk you through several tastings on the Strip or in Downtown over about 3 hours. They\u2019re a good way to sample celebrity-chef spots and hidden bites without committing to one big meal. Expect to walk and come hungry.' },
      { question: 'Can you drive a supercar in Las Vegas?', answer: 'Yes. Supercar experiences let you drive exotic cars on a real track, usually in a multi-lap session, and they\u2019re among the highest-rated Strip activities. Some run at the Las Vegas Motor Speedway. They\u2019re a popular bucket-list activity for car enthusiasts.' },
      { question: 'What are the cheapest things to do on the Las Vegas Strip?', answer: 'The most affordable Strip activities include the High Roller observation wheel, the Big Apple Coaster, the ARTE digital art museum, and Downtown walking tours. They\u2019re easy to combine and good for filling gaps between bigger plans. Many take an hour or less.' },
    ],
  },
];

async function run() {
  if (!(process.env.SANITY_API_TOKEN || process.env.SANITY_TOKEN)) {
    console.error('ERROR: SANITY_API_TOKEN no definido en .env.local. Debe ser el token de escritura de lasvegastour (kabmqky1).');
    process.exit(1);
  }
  const list = slugArg ? CATEGORIES.filter(c => c.slug === slugArg) : CATEGORIES;
  if (!list.length) { console.error(`No hay categoria con slug "${slugArg}"`); process.exit(1); }

  console.log(`${DRY ? '[DRY-RUN] ' : ''}Proyecto kabmqky1 / production — ${list.length} categoria(s)\n`);

  for (const cat of list) {
    const doc = await sanity.fetch(`*[_type == "category" && slug.current == $slug][0]{ _id, title }`, { slug: cat.slug });
    if (!doc?._id) { console.log(`  SKIP  ${cat.slug} — no encontrada`); continue; }

    const faqs = cat.faqs.map(f => ({ _type: 'faq', _key: key(), question: f.question, answer: f.answer }));
    const fields = {
      seoTitle: cat.seoTitle,
      seoDescription: cat.seoDescription,
      description: cat.description,
      faqs,
    };

    if (DRY) {
      console.log(`  DRY   ${cat.slug} (${doc.title})`);
      console.log(`        seoTitle: ${cat.seoTitle}`);
      console.log(`        seoDescription: ${cat.seoDescription.slice(0, 60)}...`);
      console.log(`        description: ${cat.description.slice(0, 60)}...`);
      console.log(`        faqs: ${faqs.length}\n`);
    } else {
      await sanity.patch(doc._id).set(fields).commit();
      console.log(`  OK    ${cat.slug} (${doc.title}) — seo + ${faqs.length} faqs`);
    }
  }
  console.log(`\n${DRY ? 'Dry-run terminado (no se escribio nada).' : 'Listo.'}`);
}

run().catch(e => { console.error(e); process.exit(1); });
