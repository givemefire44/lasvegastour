import {HomeIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const homepageType = defineType({
  name: 'homepage',
  title: 'Homepage Settings',
  type: 'document',
  icon: HomeIcon,
  fields: [
    // ========================================
    // SEO SECTION
    // ========================================
    defineField({
      name: 'seo',
      type: 'object',
      title: 'SEO Configuration',
      description: 'Configuración para motores de búsqueda',
      fields: [
        {
          name: 'title',
          type: 'string',
          title: 'SEO Title',
          description: 'Título principal para Google (50-60 caracteres)',
          validation: Rule => Rule.max(60).warning('Máximo 60 caracteres recomendado').required()
        },
        {
          name: 'description',
          type: 'text',
          title: 'SEO Description',
          description: 'Descripción que aparece en Google (150-160 caracteres)',
          rows: 3,
          validation: Rule => Rule.max(160).warning('Máximo 160 caracteres').required()
        },
        {
          name: 'keywords',
          type: 'array',
          title: 'SEO Keywords',
          description: 'Palabras clave principales (máximo 10)',
          of: [{type: 'string'}],
          options: {
            layout: 'tags'
          },
          validation: Rule => Rule.max(10).warning('Máximo 10 keywords recomendado')
        },
        {
          name: 'socialImage',
          type: 'image',
          title: 'Social Share Image',
          description: 'Imagen para Facebook, Twitter, WhatsApp (1200x630px)',
          options: {
            hotspot: true,
          },
          fields: [
            {
              name: 'alt',
              type: 'string',
              title: 'Alt text',
            }
          ]
        }
      ],
      options: {
        collapsible: true,
        collapsed: false
      }
    }),

    // ========================================
    // HERO SECTION
    // ========================================
    defineField({
      name: 'hero',
      type: 'object',
      title: 'Hero Section',
      description: 'Contenido principal de la página de inicio',
      fields: [
        {
          name: 'title',
          type: 'string',
          title: 'Hero Title',
          description: 'Título principal visible en la página'
        },
        {
          name: 'subtitle',
          type: 'text',
          title: 'Hero Subtitle',
          description: 'Subtítulo o descripción breve',
          rows: 2
        },
        {
          name: 'ctaText',
          type: 'string',
          title: 'Call to Action Text',
          description: 'Texto del botón principal',
          initialValue: 'Explore Tours'
        },
        {
          name: 'ctaUrl',
          type: 'string',
          title: 'Call to Action URL',
          description: 'URL del botón principal',
          initialValue: '/tours'
        }
      ],
      options: {
        collapsible: true,
        collapsed: true
      }
    }),

    // ========================================
    // CONTENT SECTIONS
    // ========================================
    defineField({
      name: 'content',
      type: 'object',
      title: 'Page Content',
      description: 'Secciones adicionales de contenido',
      fields: [
        {
          name: 'aboutSection',
          type: 'object',
          title: 'About Section',
          fields: [
            {
              name: 'title',
              type: 'string',
              title: 'Section Title'
            },
            {
              name: 'description',
              type: 'text',
              title: 'Description',
              rows: 4
            }
          ]
        },
        {
          name: 'featuresSection',
          type: 'object',
          title: 'Features Section',
          fields: [
            {
              name: 'title',
              type: 'string',
              title: 'Section Title'
            },
            {
              name: 'features',
              type: 'array',
              title: 'Features List',
              of: [
                {
                  type: 'object',
                  name: 'feature',
                  fields: [
                    {
                      name: 'title',
                      type: 'string',
                      title: 'Feature Title'
                    },
                    {
                      name: 'description',
                      type: 'text',
                      title: 'Feature Description',
                      rows: 2
                    },
                    {
                      name: 'icon',
                      type: 'string',
                      title: 'Feature Icon',
                      description: 'Emoji o texto del ícono',
                      initialValue: '🎯'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      options: {
        collapsible: true,
        collapsed: true
      }
    }),

    // ========================================
    // STRUCTURED DATA
    // ========================================
    defineField({
      name: 'structuredData',
      type: 'object',
      title: 'Structured Data (Schema.org)',
      description: 'Datos estructurados para la homepage',
      fields: [
        {
          name: 'organizationName',
          type: 'string',
          title: 'Organization Name',
          initialValue: 'LasVegasTour'
        },
        {
          name: 'organizationType',
          type: 'string',
          title: 'Organization Type',
          options: {
            list: [
              {title: 'Travel Agency', value: 'TravelAgency'},
              {title: 'Tour Operator', value: 'TourOperator'},
              {title: 'Local Business', value: 'LocalBusiness'},
              {title: 'Organization', value: 'Organization'}
            ]
          },
          initialValue: 'TravelAgency'
        },
        {
          name: 'description',
          type: 'text',
          title: 'Organization Description',
          description: 'Descripción de la empresa para structured data',
          rows: 3
        },
        {
          name: 'contactInfo',
          type: 'object',
          title: 'Contact Information',
          fields: [
            {
              name: 'phone',
              type: 'string',
              title: 'Phone Number'
            },
            {
              name: 'email',
              type: 'string',
              title: 'Email'
            },
            {
              name: 'address',
              type: 'text',
              title: 'Address',
              rows: 2
            }
          ]
        }
      ],
      options: {
        collapsible: true,
        collapsed: true
      }
    })
  ],
  
  preview: {
    select: {
      title: 'seo.title',
      subtitle: 'seo.description',
      media: 'seo.socialImage'
    },
    prepare(selection) {
      const {title, subtitle} = selection
      return {
        title: title || 'Homepage Settings',
        subtitle: subtitle ? `${subtitle.substring(0, 50)}...` : 'Configure homepage SEO and content'
      }
    }
  }
})