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
} satisfies Record<string, HomeImage>;
