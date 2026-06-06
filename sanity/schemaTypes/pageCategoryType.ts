// sanity/schemaTypes/pageCategoryType.ts
import {TagIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const pageCategoryType = defineType({
  name: 'pageCategory',
  title: 'Page Category',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      title: 'Category Name',
      description: 'e.g. Legal, Informational, Guides, Help',
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
      description: 'Brief description that appears on the category page',
      rows: 4,
      validation: (Rule) => Rule.required(),
    }),
    
    // Imagen para el layout tablón
    defineField({
      name: 'image',
      title: 'Category Image',
      type: 'image',
      description: 'Main image for the category page (1200x400px recommended for tablón layout)',
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
        }
      ],
      validation: (Rule) => Rule.required(),
    }),
    
    // Color para organización visual en el CMS
    defineField({
      name: 'color',
      type: 'string',
      title: 'Category Color',
      description: 'Color for visual organization in CMS and frontend',
      options: {
        list: [
          { title: 'Blue (Informational)', value: 'blue' },
          { title: 'Green (Guides)', value: 'green' },
          { title: 'Purple (Help)', value: 'purple' },
          { title: 'Orange (Legal)', value: 'orange' },
          { title: 'Red (Important)', value: 'red' },
          { title: 'Gray (General)', value: 'gray' }
        ]
      },
      initialValue: 'blue'
    }),

    // SEO específico para la página de categoría
    defineField({
      name: 'seoTitle',
      type: 'string',
      title: 'SEO: Title Tag',
      description: 'Optimized title for the category page (50-60 characters)',
      validation: Rule => Rule.max(60).warning('Maximum 60 characters for optimal SEO')
    }),
    defineField({
      name: 'seoDescription',
      type: 'text',
      title: 'SEO: Meta Description',
      description: 'Description for the category page in Google (150-160 characters)',
      rows: 3,
      validation: Rule => Rule.max(160).warning('Maximum 160 characters for optimal SEO')
    }),

    // Orden para mostrar en índices
    defineField({
      name: 'sortOrder',
      type: 'number',
      title: 'Sort Order',
      description: 'Lower numbers appear first (10, 20, 30, etc.)',
      initialValue: 10
    }),

    // Si mostrar o no en navegación
    defineField({
      name: 'showInNavigation',
      type: 'boolean',
      title: 'Show in Navigation',
      description: 'Display this category in menus/navigation',
      initialValue: true
    }),
  ],
  
  // Configuración de preview en el CMS
  preview: {
    select: {
      title: 'title',
      subtitle: 'description',
      media: 'image',
      color: 'color'
    },
    prepare(selection) {
      const { title, subtitle, color } = selection;
      const colorEmoji = {
        blue: '🔵',
        green: '🟢', 
        purple: '🟣',
        orange: '🟠',
        red: '🔴',
        gray: '⚪'
      }[color] || '🏷️';
      
      return {
        title: `${colorEmoji} ${title}`,
        subtitle: subtitle ? `${subtitle.substring(0, 50)}...` : 'No description'
      }
    },
  },

  // Configuración de ordenación en el CMS
  orderings: [
    {
      title: 'Sort Order',
      name: 'sortOrderAsc',
      by: [
        { field: 'sortOrder', direction: 'asc' },
        { field: 'title', direction: 'asc' }
      ]
    },
    {
      title: 'Name A-Z', 
      name: 'nameAsc',
      by: [{ field: 'title', direction: 'asc' }]
    }
  ]
})