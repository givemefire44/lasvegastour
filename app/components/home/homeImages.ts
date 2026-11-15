// Fotos de la home. Cada una se ABRIO antes de escribir el alt (15 nov 2026): son las de las
// tarjetas del mosaico y de destinos que eligio Mario. Se dejo afuera la de Mystere, que es un
// afiche promocional y no una foto del lugar.
const cdn = (id: string) => `https://cdn.sanity.io/images/kabmqky1/production/${id}`;

export type HomeImage = { src: string; alt: string };

export function sized(img: HomeImage, w: number, h?: number) {
  const q = h ? `?w=${w}&h=${h}&fit=crop&auto=format&q=75` : `?w=${w}&auto=format&q=75`;
  return img.src + q;
}

export const IMG = {
  // Hero cambiado el 15 nov 2026 (Mario: la anterior "no sirve"; era de 1600 px y casi toda
  // negra). Esta es de 2420 px, abierta a 1400 antes de escribir el alt.
  hero: {
    src: cdn('2373ddd0d40264d3adaa7eb58e4224b6f135ce1d-2420x1414.jpg'),
    alt: 'The Las Vegas Strip at night from above, with Excalibur, New York-New York, MGM Grand, the Paris Eiffel Tower and the High Roller wheel lit up',
  },
  skywalk: {
    src: cdn('13e7039bfe18aa8e9d10ac835033ec3e4e24b609-1600x1200.avif'),
    alt: 'Visitors on the glass Skywalk, a horseshoe-shaped walkway over the edge of the Grand Canyon at Grand Canyon West',
  },
  canyonAerial: {
    src: cdn('32395c9424404cfadbb0eef13d8f7cc3b66786e9-3300x2200.jpg'),
    alt: 'The Grand Canyon from the air, with the Colorado River winding between red rock walls',
  },
  helicopter: {
    src: cdn('7c29c6aa67871d5e1c2495ffc68a5b3d274eb5e4-1600x1200.avif'),
    alt: 'A silver tour helicopter flying low over red sandstone in the desert',
  },
  cirque: {
    src: cdn('207cd1ed32253f2151f73f857aa2fd0a87bf194e-1600x1200.avif'),
    alt: 'Costumed performers on a lit stage during a Cirque du Soleil show',
  },
  sphere: {
    src: cdn('3baddfc2a6148ff4fea50169b2a8cb8659d674e0-1600x1200.avif'),
    alt: 'The Sphere in Las Vegas at night, its exterior screen showing The Wizard of Oz title',
  },
  hoover: {
    src: cdn('6b4fde3cf3745d41f6f4fc3187caf67b27b5b2f5-1600x1200.avif'),
    alt: 'Hoover Dam with the Colorado River below and the Mike O’Callaghan–Pat Tillman Memorial Bridge arching behind it',
  },
  // Grilla "Explore Las Vegas" (15 nov 2026): fotos de fichas de tour en 2420 px, abiertas en
  // una hoja de contactos antes de escribir cada alt.
  skywalkSunset: {
    src: cdn('ccfabcc7e308961dff32fac57dae57944385143d-2420x1559.jpg'),
    alt: 'The glass Skywalk jutting out over the Grand Canyon at sunset, with the canyon walls lit red below',
  },
  heliLanding: {
    src: cdn('55519cdca8d189cad4bcdedb90ae025032b5b396-2420x1614.jpg'),
    alt: 'A red tour helicopter parked on the floor of the Grand Canyon, with tall canyon walls behind it',
  },
  hooverTowers: {
    src: cdn('b664068910cec10e8b3da192b5538ff43866e715-2420x1615.jpg'),
    alt: 'Hoover Dam and its intake towers rising from green water, with the bypass bridge in the background',
  },
  kayak: {
    src: cdn('0daea5f0463869691d108c1416f59b4f8ae80cc7-1600x1200.avif'),
    alt: 'Kayakers paddling on bright green water between steep rock walls on the Colorado River',
  },
  desertRoad: {
    src: cdn('4e9d510d58ff5f67795e991fac12a01c5e08a417-2420x1613.jpg'),
    alt: 'A desert highway running through Joshua trees toward mountains lit by the setting sun',
  },
  // Collage del hero (15 nov 2026): heros de articulos en 2420 px, abiertos a 1100 antes del
  // alt. Se dejaron afuera los heros que son renders de IA.
  westViewpoint: {
    src: cdn('6c1075ecf14ff0ad0765de52262ab232657b1309-2420x1602.jpg'),
    alt: 'The Colorado River winding through the Grand Canyon, seen from a rocky viewpoint at Grand Canyon West',
  },
  stripDusk: {
    src: cdn('bb9e9a533c6c610e7273c75921964d37eac331ca-1600x1200.avif'),
    alt: 'The Las Vegas Strip at dusk with the Bellagio fountains, the Paris balloon sign and Eiffel Tower, and Caesars Palace behind',
  },
  sphereDay: {
    src: cdn('6e4794e2314023919ede313973dff4d7119fdc25-2420x1361.jpg'),
    alt: 'The Sphere in Las Vegas showing a Wizard of Oz farmhouse on its outer screen, with the High Roller wheel behind it',
  },
} satisfies Record<string, HomeImage>;
