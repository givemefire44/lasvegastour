export interface ProTip {
  icon: string;
  text: string;
  slug: string;
}

export const proTips: ProTip[] = [
  // ─── Biblioteca: PRIMERO, como en el resto del portfolio ───
  // No es una page de Sanity: es la ruta app/las-vegas-guides/page.tsx.
  {
    icon: '📚',
    text: 'The Las Vegas Guides Library: Every Guide in One Place',
    slug: 'las-vegas-guides'
  },

  // ─── Research Program ───
  // Tampoco es una page: app/las-vegas-research/page.tsx.
  // Los artículos nuevos del programa entran acá arriba y el resto baja.
  {
    icon: '📊',
    text: 'The Las Vegas Research Program',
    slug: 'las-vegas-research'
  },
  {
    icon: '🎭',
    text: 'What a Las Vegas Show’s Rating Doesn’t Tell You',
    slug: 'las-vegas-show-ratings-what-they-hide'
  },

  // ─── Day trips estrella + experiencias marquee (monetizan / alto search) ───
  {
    icon: '🏜️',
    text: 'Grand Canyon: West vs South Rim',
    slug: 'grand-canyon-west-vs-south-rim-from-las-vegas'
  },
  {
    icon: '🚁',
    text: 'Helicopter Tours: Which Is Worth It',
    slug: 'las-vegas-helicopter-tours-which-worth-it'
  },
  {
    icon: '🌐',
    text: 'Sphere: Best Seats & Tickets',
    slug: 'sphere-las-vegas-seats-tickets-guide'
  },
  {
    icon: '🎭',
    text: 'Shows: How to Pick the Right One',
    slug: 'how-to-choose-las-vegas-shows'
  },
  {
    icon: '🏗️',
    text: 'Hoover Dam: Is It Worth It?',
    slug: 'hoover-dam-tour-from-las-vegas'
  },
  {
    icon: '🧗',
    text: 'Red Rock Canyon Day Trip',
    slug: 'red-rock-canyon-from-las-vegas'
  },
  {
    icon: '🔥',
    text: 'Valley of Fire Day Trip',
    slug: 'valley-of-fire-from-las-vegas'
  },
  {
    icon: '🪩',
    text: 'Nightlife & Club Crawls',
    slug: 'las-vegas-nightlife-club-crawls'
  },

  // ─── Planificación, presupuesto y logística (alto tráfico / soporte) ───
  {
    icon: '💵',
    text: 'What a Vegas Trip Really Costs',
    slug: 'how-much-las-vegas-trip-costs'
  },
  {
    icon: '🧾',
    text: 'Resort Fees, Tipping & Hidden Charges',
    slug: 'las-vegas-resort-fees-tipping-hidden-charges'
  },
  {
    icon: '⚠️',
    text: '7 Costly First-Timer Mistakes',
    slug: 'most-expensive-first-timer-mistakes-las-vegas'
  },
  {
    icon: '🧭',
    text: 'Plan Your First Vegas Trip',
    slug: 'first-time-las-vegas-how-to-plan'
  },
  {
    icon: '🚌',
    text: 'Getting Around Without a Car',
    slug: 'how-to-get-around-las-vegas'
  },
  {
    icon: '🎰',
    text: 'Gamble Smart: Odds & Budget',
    slug: 'las-vegas-casino-gambling-responsibly'
  },

  // ─── Agrupador de categoría: ÚLTIMO, como en los otros tres sitios ───
  // Es el hub /pages/[category], no una page suelta. Por eso lleva el prefijo.
  {
    icon: '⏩',
    text: 'Las Vegas Tours and Tips',
    slug: 'pages/las-vegas-tours-and-tips'
  },
];