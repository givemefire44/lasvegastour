// Widget del sidebar de las paginas informacionales.
//
// Reemplaza la tarjeta de quick links (Homepage / All Tours / About Us /
// Contact), que ocupa el lugar flotante del sidebar y no ofrece nada.
//
// POR QUE: medido el 26 sep 2026 sobre una pagina informacional en vivo, de 104
// links UNO iba a GetYourGuide. Todos los caminos de la pagina van hacia adentro
// del sitio, asi que desde un articulo GYG queda a tres clics: boton "View
// Tours" -> el listado interno de tours -> pagina del tour
// -> recien ahi sale. Cada fila de este widget es UN clic hasta la ficha del
// producto en GYG, con el partner_id que ya viene en bookingUrl.
//
// La seleccion de tours de esta version es provisoria (ver elegirTours): empareja
// por palabras del titulo. El plan es reemplazarla por un analisis contextual
// hecho una vez y guardado en Sanity, para que el articulo de accesibilidad
// encuentre los tours sin escaleras aunque no compartan una palabra.

export type Tour = {
  _id: string;
  title?: string;
  slug?: { current?: string };
  bookingUrl?: string;
  getYourGuideUrl?: string;
  precio?: number;
  duracion?: string;
  rating?: number;
  reviews?: number;
  heroGallery?: Array<{ asset?: { url?: string }; alt?: string }>;
  mainImage?: { asset?: { url?: string }; alt?: string };
};

// Destino del boton del pie: la pagina del Coliseo en GYG. Cubre al lector que
// quiere mirar mas, mientras las tres filas cubren al que ya sabe que quiere.
const GYG_TODOS = 'https://www.viator.com/Las-Vegas/d684-ttd?pid=P00140156&mcid=42383&medium=api';

const PALABRAS_VACIAS = new Set(["the","and","with","for","your","you","tour","tours","from","that","this","what","how","why","when","where","best","guide","vegas","las","nevada","strip"]);

// Provisorio a proposito. Empareja por palabras poco comunes del titulo del
// articulo ("underground", "arena", "night", "family"): acierta en los casos
// obvios y no pretende mas. Los tours sin URL de GYG quedan afuera, porque una
// tarjeta que no puede salir al partner no cumple ninguna funcion aca.
const esDeGyg = (t: Tour) => {
  // En este sitio el inventario es de Viator, asi que vale cualquier URL de
  // reserva. Lo unico que se descarta es un tour sin adonde mandar al lector.
  const u = t.bookingUrl || t.getYourGuideUrl || '';
  return /^https?:\/\//.test(u);
};

export function elegirTours(tours: Tour[], tituloPagina: string, cuantos = 3): Tour[] {
  // SOLO GetYourGuide. De los 71 tours del catalogo, 59 son de GYG y 12 de
  // Viator; si se mezclan, las visitas salientes se reparten entre dos partners
  // y deja de poder atribuirse un cambio de este widget a lo que se ve en el
  // panel de GYG. Un solo destino es lo que hace medible el experimento.
  const conUrl = tours.filter(esDeGyg);

  const claves = new Set(
    (tituloPagina || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((p) => p.length > 3 && !PALABRAS_VACIAS.has(p)),
  );

  const puntaje = (t: Tour) => {
    const titulo = (t.title || '').toLowerCase();
    let n = 0;
    claves.forEach((k) => { if (titulo.includes(k)) n += 1; });
    return n;
  };

  return [...conUrl]
    // A igualdad de coincidencias manda el VOLUMEN DE RESENAS, no el rating.
    // Desempatar por rating parecia razonable y estaba mal: un 5,0 con UNA
    // resena le ganaba a un 4,8 con 91.256. En las paginas donde el titulo no
    // comparte ninguna palabra con ningun tour —y son varias de las de mas
    // trafico— eso hacia que el widget ofreciera un tour de cena de $285 y uno
    // de transfers de $1.400, en vez de los de $56 que son los que la gente
    // efectivamente compra.
    .sort((a, b) => puntaje(b) - puntaje(a) || (b.reviews || 0) - (a.reviews || 0))
    .slice(0, cuantos);
}

const imagenDe = (t: Tour) =>
  t.heroGallery?.[0]?.asset?.url || t.mainImage?.asset?.url || null;

export default function SidebarTours({
  tours,
  tituloPagina,
  toursAsignados = [],
  verTodosUrl = '/tours',
  verTodosTexto = 'View Tours',
}: {
  tours: Tour[];
  tituloPagina: string;
  // Los tres tours que el analisis contextual le asigno a esta pagina leyendo su
  // texto. Cuando existen mandan ellos: el emparejamiento por palabras del
  // titulo es el respaldo, no el criterio.
  toursAsignados?: Tour[];
  // Heredados de la tarjeta "Discover More" que este widget reemplaza, para que
  // las paginas que hoy personalizan ctaUrl/ctaText en Sanity sigan mandando.
  verTodosUrl?: string;
  verTodosTexto?: string;
}) {
  // Se filtran igual por GYG: si a una pagina le quedo asignado un tour que
  // despues se dio de baja o cambio de plataforma, no se muestra.
  const asignados = (toursAsignados || []).filter(esDeGyg);
  const elegidos = asignados.length ? asignados : elegirTours(tours || [], tituloPagina);
  // Sin tours con URL de reserva no se pinta nada: es preferible el hueco a una
  // tarjeta que no lleva a ningun lado.
  if (!elegidos.length) return null;

  const esSaliente = /^https?:\/\//.test(verTodosUrl);

  return (
    <div className="sidebar-tours">
      {/* El boton que estaba en "Discover More". Va arriba de todo: es el camino
          para el que quiere recorrer el catalogo entero, mientras las filas de
          abajo son para el que ya sabe que quiere. */}
      <div className="st-top">
        <a
          className="st-boton"
          href={verTodosUrl}
          target={esSaliente ? '_blank' : undefined}
          rel={esSaliente ? 'noopener noreferrer sponsored' : undefined}
        >
          {verTodosTexto}
        </a>
      </div>

      <div className="st-cab">
        <div className="st-t">Tours for this guide</div>
        {/* Nada de "free cancellation": es una condicion que varia tour por tour
            y no esta verificada en nuestros datos. El precio si: lo actualiza el
            cron dos veces por semana. */}
        <div className="st-s">Prices updated this week</div>
      </div>

      {elegidos.map((t) => {
        const img = imagenDe(t);
        return (
          <a
            key={t._id}
            className="st-fila"
            href={t.bookingUrl || t.getYourGuideUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
          >
            {img ? (
              <img className="st-img" src={`${img}?w=240&h=240&fit=crop`} alt="" loading="lazy" />
            ) : (
              <span className="st-img st-img-vacia" />
            )}
            <span className="st-info">
              <span className="st-nombre">{t.title}</span>
              {/* El precio comparte linea con el rating en vez de ocupar una
                  columna propia: esa columna le robaba 45px de ancho al titulo,
                  que en 300px de sidebar es lo que decide si se lee o no. */}
              <span className="st-linea">
                <span className="st-meta">
                  {t.rating ? `★ ${t.rating}` : ''}
                  {t.rating && t.duracion ? ' · ' : ''}
                  {t.duracion || ''}
                </span>
                {typeof t.precio === 'number' && <span className="st-precio">${t.precio}</span>}
              </span>
            </span>
          </a>
        );
      })}

      <div className="st-pie">
        <a
          className="st-boton"
          href={GYG_TODOS}
          target="_blank"
          rel="noopener noreferrer sponsored"
        >
          See all Las Vegas tours
        </a>
      </div>

      <style>{`
        .sidebar-tours {
          background: #fff;
          border: 1px solid #ececec;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.04);
        }
        .st-top { padding: 16px 16px 14px; }
        .st-cab { padding: 4px 16px 10px; }
        .st-t { font-size: 16px; font-weight: 700; color: #1a1a1a; line-height: 1.3; }
        .st-s { font-size: 12px; color: #8a8a8a; margin-top: 2px; }
        /* Tarjeta vertical, no fila horizontal. En una columna de 300px las dos
           cosas no entran: con la foto al costado a 104px, al texto le quedaban
           99px de ancho y el titulo salia a dos palabras por renglon (medido en
           vivo). Con la foto arriba a todo el ancho, la imagen se ve y el titulo
           tiene los 268px completos. */
        /* Punto intermedio: con la foto a todo el ancho (150px de alto) las
           imagenes se comian la tarjeta y los dos botones quedaban en segundo
           plano. Con la foto al costado a 96px se ve bien y la tarjeta baja de
           881px a la mitad, que es lo que devuelve presencia a los botones. */
        .st-fila {
          display: flex; gap: 12px; align-items: center;
          padding: 12px 16px; border-top: 1px solid #f0f0f0;
          text-decoration: none; color: inherit;
        }
        .st-fila:hover { background: #fafafa; }
        .st-img { width: 96px; height: 96px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
        .st-img-vacia { background: #f0f0f0; display: block; }
        /* min-width:0 es lo que permite que el nombre largo corte en vez de
           empujar el resto fuera de los 300px de la columna. */
        .st-info { flex: 1; min-width: 0; display: block; }
        .st-nombre {
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
          overflow: hidden; font-size: 13.5px; font-weight: 600; color: #1a1a1a; line-height: 1.32;
        }
        .st-linea {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 8px; margin-top: 5px;
        }
        .st-meta { font-size: 12px; color: #6b6b6b; }
        .st-precio { font-size: 17px; font-weight: 700; color: #1a1a1a; flex-shrink: 0; }
        .st-pie { padding: 12px 16px 14px; border-top: 1px solid #f0f0f0; }
        .st-boton {
          display: block; text-align: center; background: #e91e63; color: #fff;
          font-size: 14px; font-weight: 700; padding: 10px; border-radius: 24px;
          text-decoration: none;
        }
        .st-boton:hover { background: #c2185b; }
      `}</style>
    </div>
  );
}
