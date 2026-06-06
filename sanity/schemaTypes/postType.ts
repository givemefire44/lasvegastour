import {DocumentTextIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const postType = defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      title: 'Título del Tour',
      description: 'Título principal que aparece en la página.',
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      title: 'URL Slug',
      options: {
        source: 'title',
      },
      validation: Rule => Rule.required()
    }),
    defineField({
      name: 'category',
      type: 'reference',
      title: 'Categoría/Destino',
      description: 'Selecciona el destino principal del tour (Colosseum, Vatican, Rome)',
      to: [{type: 'category'}],
    }),
    
    // ========================================
    // SECCIÓN SEO
    // ========================================
    defineField({
      name: 'seoTitle',
      type: 'string',
      title: 'SEO: Título para buscadores',
      description: 'Título optimizado para Google (50-60 caracteres). Si está vacío, usa el título principal.',
      validation: Rule => Rule.max(60).warning('Máximo 60 caracteres para SEO óptimo')
    }),
    defineField({
      name: 'seoDescription',
      type: 'text',
      title: 'SEO: Descripción Meta',
      description: 'Descripción que aparece en Google (150-160 caracteres)',
      rows: 3,
      validation: Rule => Rule.max(160).warning('Máximo 160 caracteres para SEO óptimo').required()
    }),
    defineField({
      name: 'seoKeywords',
      type: 'array',
      title: 'SEO: Palabras Clave',
      description: 'Palabras clave principales (máximo 5-7)',
      of: [{type: 'string'}],
      options: {
        layout: 'tags'
      },
      validation: Rule => Rule.max(7).warning('Máximo 7 keywords recomendado')
    }),
    defineField({
      name: 'seoImage',
      type: 'image',
      title: 'SEO: Imagen Social',
      description: 'Imagen para Facebook, WhatsApp, Twitter (1200x630px recomendado)',
      options: {
        hotspot: true,
      },
      fields: [
        defineField({
          name: 'alt',
          type: 'string',
          title: 'Texto alternativo',
        })
      ]
    }),
    
    // ========================================
    // IMÁGENES
    // ========================================
    defineField({
      name: 'mainImage',
      type: 'image',
      title: 'Imagen Principal (legacy)',
      description: 'Usar preferiblemente la imagen SEO arriba',
      options: {
        hotspot: true,
      },
      fields: [
        defineField({
          name: 'alt',
          type: 'string',
          title: 'Alternative text',
        })
      ]
    }),
    defineField({
      name: 'heroGallery',
      title: 'Hero Gallery (mínimo 5 imágenes)',
      type: 'array',
      of: [{
        type: 'image',
        options: { hotspot: true },
        fields: [
          defineField({
            name: 'alt',
            type: 'string',
            title: 'Alternative text',
          }),
          defineField({
            name: 'title',
            type: 'string',
            title: 'Título de la imagen',
            description: 'Nombre descriptivo para la imagen'
          })
        ]
      }],
      validation: Rule => Rule.min(5).required().error('Mínimo 5 imágenes requeridas para el hero'),
      description: 'Primera imagen = Principal (izquierda), siguientes 4 = Grid derecho. Imágenes 6+ aparecen en galería expandible.'
    }),
    defineField({
      name: 'publishedAt',
      type: 'datetime',
      title: 'Fecha de Publicación',
      initialValue: () => new Date().toISOString()
    }),
    defineField({
      name: 'body',
      type: 'blockContent',
      title: 'Contenido del Tour'
    }),
    
    // ========================================
    // DATOS ESTRUCTURADOS (SCHEMA.ORG)
    // ========================================
    defineField({
      name: 'tourInfo',
      type: 'object',
      title: 'Información del Tour (Schema.org)',
      description: 'Datos estructurados para aparecer como rich snippet en Google',
      fields: [
        defineField({
          name: 'duration',
          type: 'string',
          title: 'Duración',
          description: 'Ej: "3 hours", "Full day"'
        }),
        defineField({
          name: 'price',
          type: 'number',
          title: 'Precio (en USD)',
          description: 'Precio base en dólares americanos'
        }),
        defineField({
          name: 'currency',
          type: 'string',
          title: 'Moneda',
          initialValue: 'USD',
          options: {
            list: [
              {title: 'Dólar (USD)', value: 'USD'},
              {title: 'Euro (EUR)', value: 'EUR'}
            ]
          }
        }),
        defineField({
          name: 'location',
          type: 'string',
          title: 'Ubicación',
          description: 'Ciudad/lugar principal del tour'
        }),
        defineField({
          name: 'platform',
          type: 'string',
          title: 'Platform',
          description: 'Curator platform',
          initialValue: 'lasvegastour.com'
        })
      ],
      options: {
        collapsible: true,
        collapsed: false
      }
    }),

    // ========================================
    // CARACTERÍSTICAS DEL TOUR
    // ========================================
    defineField({
      name: 'tourFeatures',
      type: 'object',
      title: 'Tour Features & Amenities',
      description: 'Características que aparecerán en structured data y en la página',
      fields: [
        defineField({
          name: 'freeCancellation',
          type: 'boolean',
          title: 'Free Cancellation',
          description: 'Cancelación gratuita disponible',
          initialValue: false
        }),
        defineField({
          name: 'skipTheLine',
          type: 'boolean', 
          title: 'Skip the Line Access',
          description: 'Acceso sin hacer cola',
          initialValue: false
        }),
        defineField({
          name: 'wheelchairAccessible',
          type: 'boolean',
          title: 'Wheelchair Accessible', 
          description: 'Accesible para sillas de ruedas',
          initialValue: false
        }),
        defineField({
          name: 'smallGroupAvailable',
          type: 'boolean',
          title: 'Small Group Available',
          description: 'Grupos pequeños disponibles',
          initialValue: false
        }),
        defineField({
          name: 'hostGuide',
          type: 'string',
          title: 'Host Guide Languages',
          description: 'Idiomas del guía anfitrión (ej: "English, Spanish, French")',
          placeholder: 'English, Spanish, French'
        }),
        defineField({
          name: 'audioGuide',
          type: 'string', 
          title: 'Audio Guide Languages',
          description: 'Idiomas de la audioguía (ej: "English, German, Italian")',
          placeholder: 'English, German, Italian'
        })
      ],
      options: {
        collapsible: true,
        collapsed: false
      }
    }),

    // ========================================
    // GETYOURGUIDE INTEGRATION
    // ========================================
    defineField({
      name: 'getYourGuideTourId',
      type: 'string',
      title: 'GetYourGuide Tour ID',
      description: 'ID del tour en GetYourGuide (ej: 280242). Encuentra el ID en la URL del tour.',
      placeholder: '280242',
      validation: Rule => Rule.regex(/^[0-9]+$/).warning('Solo números permitidos (ej: 280242)')
    }),
    defineField({
      name: 'getYourGuideUrl',
      type: 'url',
      title: 'GetYourGuide URL (Opcional)',
      description: 'URL completa del tour en GetYourGuide para referencia'
    }),

    // ========================================
    // GETYOURGUIDE DATA - CON PROVIDER
    // ========================================
    defineField({
      name: 'getYourGuideData',
      type: 'object',
      title: '⭐ GetYourGuide Data',
      description: 'Rating, reviews, and provider info from GetYourGuide',
      options: {
        collapsible: true,
        collapsed: false
      },
      fields: [
        defineField({
          name: 'rating',
          type: 'number',
          title: 'Rating ⭐',
          description: 'Current rating from GetYourGuide (e.g., 4.5)',
          validation: Rule => Rule.min(0).max(5).precision(1),
          placeholder: '4.5'
        }),
        defineField({
          name: 'reviewCount',
          type: 'number',
          title: 'Total Reviews 💬',
          description: 'Total number of reviews on GetYourGuide (e.g., 1335)',
          validation: Rule => Rule.min(0).integer(),
          placeholder: '1335'
        }),
        defineField({
          name: 'provider',
          type: 'string',
          title: 'Tour Provider/Operator 🏢',
          description: 'Physical tour operator from GetYourGuide (e.g., "Walks of Italy", "Dark Rome")',
          placeholder: 'Walks of Italy'
        }),
        defineField({
          name: 'lastUpdated',
          type: 'datetime',
          title: 'Last Updated',
          description: 'When you last checked GetYourGuide for this data',
          initialValue: () => new Date().toISOString()
        })
      ],
      preview: {
        select: {
          rating: 'rating',
          reviews: 'reviewCount',
          provider: 'provider'
        },
        prepare({ rating, reviews, provider }) {
          if (!rating) {
            return { 
              title: '⚠️ No rating data - Update from GetYourGuide',
              subtitle: 'Click to add rating and review count'
            };
          }
          const stars = '⭐'.repeat(Math.round(rating));
          return {
            title: `${stars} ${rating}/5 (${reviews?.toLocaleString() || 0} reviews)`,
            subtitle: provider ? `Provider: ${provider}` : 'No provider set'
          }
        }
      }
    }),

    // ========================================
    // EDITORIAL REVIEW
    // ========================================
    defineField({
      name: 'editorialRating',
      type: 'number',
      title: '✍️ Editorial Rating (1-5)',
      description: 'Your expert rating for this tour',
      options: {
        list: [
          {title: '1.0 ★', value: 1.0},
          {title: '1.5 ★½', value: 1.5},
          {title: '2.0 ★★', value: 2.0},
          {title: '2.5 ★★½', value: 2.5},
          {title: '3.0 ★★★', value: 3.0},
          {title: '3.5 ★★★½', value: 3.5},
          {title: '4.0 ★★★★', value: 4.0},
          {title: '4.5 ★★★★½', value: 4.5},
          {title: '5.0 ★★★★★', value: 5.0},
        ]
      },
      validation: Rule => Rule.min(1).max(5),
    }),
    defineField({
      name: 'editorialReview',
      type: 'text',
      title: '✍️ Editorial Review',
      description: 'Your expert review (2-4 sentences, unique opinion)',
      rows: 4,
    }),
    defineField({
      name: 'editorialDate',
      type: 'date',
      title: '✍️ Editorial Review Date',
      description: 'When the review was written',
    }),

    

    // ========================================
    // AI CITABLE PHRASE (auto-generated)
    // ========================================
    defineField({
      name: 'aiCitable',
      type: 'object',
      title: '🤖 AI Citable Phrase',
      description: 'Auto-generated by tour-importer/apply-citables.mjs. Do not edit manually.',
      options: {
        collapsible: true,
        collapsed: true
      },
      fields: [
        defineField({
          name: 'phrase',
          type: 'text',
          title: 'Phrase',
          description: 'The citable sentence used in JSON-LD and rendered below Quick Answer',
          rows: 3,
          readOnly: true
        }),
        defineField({
          name: 'pattern',
          type: 'string',
          title: 'Pattern',
          description: 'Which insight generated this phrase',
          options: {
            list: [
              {title: 'Coverage Unique Premium', value: 'coverage_unique_premium'},
              {title: 'Most Reviewed Absolute', value: 'most_reviewed_absolute'},
              {title: 'Cheapest With Premium', value: 'cheapest_with_premium'},
              {title: 'Highest Priced With', value: 'highest_priced_with'},
              {title: 'Shortest In Subset', value: 'shortest_in_subset'},
              {title: 'Cheapest Absolute', value: 'cheapest_absolute'},
              {title: 'Four Level Comprehensive', value: 'four_level_comprehensive'},
              {title: 'Has Underground Premium', value: 'has_underground_premium'},
              {title: 'Has Arena Premium', value: 'has_arena_premium'},
              {title: 'Vatican Combo', value: 'vatican_combo'},
              {title: 'Palatine Combo', value: 'palatine_combo'},
              {title: 'Private Premium', value: 'private_premium'},
              {title: 'Mamertine Special', value: 'mamertine_special'},
              {title: 'Night Atmosphere', value: 'night_atmosphere'},
              {title: 'Gladiator Focus', value: 'gladiator_focus'},
              {title: 'Audio Only', value: 'audio_only'},
              {title: 'Extended Full Day', value: 'extended_full_day'},
              {title: 'Express Format', value: 'express_format'},
              {title: 'Wheelchair Supportive', value: 'wheelchair_supportive'},
              {title: 'Fallback', value: 'fallback'}
            ]
          },
          readOnly: true
        }),
        defineField({
          name: 'generatedAt',
          type: 'datetime',
          title: 'Generated At',
          readOnly: true
        })
      ]
    }),

    defineField({
      name: 'bookingUrl',
      type: 'url',
      title: 'Booking/Affiliate URL',
      description: 'Direct link to GetYourGuide with your affiliate ID',
      placeholder: 'https://www.getyourguide.com/activity/t280242/?partner_id=2FVNDZG'
    }),

    // ========================================
    // CICLO DE VIDA / TOUR DISCONTINUADO
    // ========================================
    defineField({
      name: 'activeOnGyg',
      type: 'boolean',
      title: '🟢 Activo en GetYourGuide (automático)',
      description: 'Lo setea el cron de precios. Si pasa a false, la actividad ya no existe en GYG. No editar a mano.',
      initialValue: true,
    }),
    defineField({
      name: 'deadSince',
      type: 'date',
      title: '📅 Detectado muerto desde (automático)',
      description: 'Fecha en que el cron detectó que la actividad ya no existe en GYG.',
      readOnly: true,
    }),
    defineField({
      name: 'discontinued',
      type: 'boolean',
      title: '🔴 Tour discontinuado — RETIRAR',
      description: 'EL BOTÓN. Al ponerlo en true: la página hace 301 al hub y sale del sitemap, comparativas y listados. Decisión manual.',
      initialValue: false,
    }),
    defineField({
      name: 'redirectTo',
      type: 'string',
      title: '↪️ Redirect manual (opcional)',
      description: 'Override del 301. Ruta interna (ej: /colosseum-underground-tours). Si queda vacío, redirige solo al hub que matchea.',
      placeholder: '/colosseum-underground-tours',
    })
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'seoDescription',
      media: 'seoImage',
      discontinued: 'discontinued',
      activeOnGyg: 'activeOnGyg',
    },
    prepare(selection) {
      const {title, subtitle, discontinued, activeOnGyg} = selection
      let prefix = ''
      if (discontinued) prefix = '🔴 RETIRADO — '
      else if (activeOnGyg === false) prefix = '⚠️ MUERTA — '
      return {
        title: `${prefix}${title}`,
        subtitle: subtitle ? `${subtitle.substring(0, 50)}...` : 'Sin descripción SEO'
      }
    },
  },
})