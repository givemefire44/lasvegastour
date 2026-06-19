import {TagIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const categoryType = defineType({
  name: 'category',
  title: 'Category',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      title: 'Category Name',
      description: 'e.g. Roma, Paris, Madrid',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      title: 'Slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      type: 'text',
      title: 'Description',
      description: 'Brief description that appears under the title',
      rows: 3,
    }),
    
    // ========================================
    // IMAGEN PRINCIPAL (HERO)
    // ========================================
    defineField({
      name: 'showHeroImage',
      title: 'Show hero image',
      type: 'boolean',
      description: 'If off, the category page shows no hero banner (avoids an empty container when there is no image).',
      initialValue: true,
    }),
    defineField({
      name: 'image',
      title: 'Hero Image',
      type: 'image',
      description: 'Main image for the category page hero section (1200x600px recommended)',
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alternative Text',
          description: 'Describe the image for accessibility and SEO',
          validation: (Rule) => Rule.required()
        },
        {
          name: 'heading',
          type: 'string',
          title: 'Image Heading/Caption',
          description: 'Optional heading text to overlay on the image'
        }
      ],
    }),
    
    // ========================================
    // SECCIÓN SEO COMPLETA
    // ========================================
    defineField({
      name: 'seoTitle',
      type: 'string',
      title: 'SEO: Title Tag',
      description: 'Optimized title for search engines (50-60 characters). If empty, uses category name.',
      validation: Rule => Rule.max(60).warning('Maximum 60 characters for optimal SEO')
    }),
    defineField({
      name: 'seoDescription',
      type: 'text',
      title: 'SEO: Meta Description',
      description: 'Description that appears in Google search results (150-160 characters)',
      rows: 3,
      validation: Rule => Rule.max(160).warning('Maximum 160 characters for optimal SEO').required()
    }),
    defineField({
      name: 'seoKeywords',
      type: 'array',
      title: 'SEO: Keywords',
      description: 'Main keywords for this destination (maximum 5-7)',
      of: [{type: 'string'}],
      options: {
        layout: 'tags'
      },
      validation: Rule => Rule.max(7).warning('Maximum 7 keywords recommended')
    }),
    defineField({
      name: 'seoImage',
      type: 'image',
      title: 'SEO: Social Media Image',
      description: 'Image for Facebook, WhatsApp, Twitter sharing (1200x630px recommended)',
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alternative text',
        }
      ]
    }),
    
    // ========================================
    // CONTENIDO ADICIONAL
    // ========================================
    defineField({
      name: 'longDescription',
      type: 'text',
      title: 'Long Description',
      description: 'Detailed description for the category page content (for SEO and users)',
      rows: 5,
    }),
    defineField({
      name: 'featuredText',
      type: 'string',
      title: 'Featured Text',
      description: 'Short compelling text to highlight this destination',
    }),
    
    // ========================================
    // CONTENIDO ADICIONAL PARA LA PÁGINA
    // ========================================
    defineField({
      name: 'pageContent',
      type: 'object',
      title: 'Page Content & Features',
      description: 'Content that appears on the category page',
      fields: [
        {
          name: 'heroTitle',
          type: 'string',
          title: 'Hero Title Override',
          description: 'Custom title for the hero section (uses category title if empty)'
        },
        {
          name: 'heroSubtitle',
          type: 'text',
          title: 'Hero Subtitle',
          description: 'Subtitle that appears under the hero title',
          rows: 2
        },
        {
          name: 'highlights',
          type: 'array',
          title: 'Category Highlights',
          description: 'Key features or selling points (max 4)',
          of: [
            {
              type: 'object',
              fields: [
                {
                  name: 'title',
                  type: 'string',
                  title: 'Highlight Title'
                },
                {
                  name: 'description',
                  type: 'string',
                  title: 'Brief Description'
                },
                {
                  name: 'icon',
                  type: 'string',
                  title: 'Icon (emoji)',
                  initialValue: '✨'
                }
              ]
            }
          ],
          validation: Rule => Rule.max(4).warning('Maximum 4 highlights recommended')
        }
      ],
      options: {
        collapsible: true,
        collapsed: true
      }
    }),

    // ========================================
    // FAQs - Para SEO y Featured Snippets
    // ========================================
    defineField({
      name: 'faqs',
      type: 'array',
      title: 'FAQs',
      description: 'Frequently asked questions for this category. These generate FAQPage schema for Google featured snippets.',
      of: [
        {
          type: 'object',
          name: 'faq',
          title: 'FAQ Item',
          fields: [
            {
              name: 'question',
              type: 'string',
              title: 'Question',
              description: 'Use questions people actually search for (e.g. "Is the Colosseum underground tour worth it?")',
              validation: (Rule) => Rule.required()
            },
            {
              name: 'answer',
              type: 'text',
              title: 'Answer',
              description: 'Concise, helpful answer (2-4 sentences ideal for featured snippets)',
              rows: 4,
              validation: (Rule) => Rule.required()
            }
          ],
          preview: {
            select: {
              title: 'question',
              subtitle: 'answer'
            },
            prepare({title, subtitle}) {
              return {
                title: title || 'New FAQ',
                subtitle: subtitle ? subtitle.substring(0, 60) + '...' : 'No answer yet'
              }
            }
          }
        }
      ],
 
    }),
    
    // ========================================
    // CAMPOS LEGACY (mantener compatibilidad)
    // ========================================
    defineField({
      name: 'metaTitle',
      title: 'Meta Title (LEGACY)',
      type: 'string',
      description: 'DEPRECATED: Use seoTitle instead',
      hidden: true,
    }),
    defineField({
      name: 'metaDescription',
      title: 'Meta Description (LEGACY)',
      type: 'text',
      description: 'DEPRECATED: Use seoDescription instead',
      hidden: true,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'seoDescription',
      media: 'image',
    },
    prepare(selection) {
      const {title, subtitle} = selection
      return {
        title: title,
        subtitle: subtitle ? `${subtitle.substring(0, 50)}...` : 'No SEO description'
      }
    },
  },
})