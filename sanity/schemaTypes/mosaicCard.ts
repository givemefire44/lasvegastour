// sanity/schemaTypes/mosaicCard.ts
import { defineType } from 'sanity'

export default defineType({
  name: 'mosaicCard',
  title: 'Mosaic Cards',
  type: 'document',
  icon: () => '🏨',
  fields: [
    {
      name: 'name',
      title: 'Nombre',
      type: 'string',
      description: 'Nombre del lugar o establecimiento'
    },
    {
      name: 'location',
      title: 'Ubicación',
      type: 'string',
      description: 'Ciudad y país'
    },
    {
      name: 'image',
      title: 'Imagen',
      type: 'image',
      description: 'Imagen del lugar (recomendado: 400x300px)',
      options: {
        hotspot: true,
        storeOriginalFilename: false
      },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alt Text',
          description: 'Descripción de la imagen para buscadores y accesibilidad'
        }
      ]
    },
    {
      name: 'seoTitle',
      title: 'SEO Título',
      type: 'string',
      description: 'Título optimizado para buscadores (opcional, usa "Nombre" si está vacío)'
    },
    {
      name: 'url',
      title: 'URL/Link',
      type: 'string',
      description: 'Link al tour o página de destino (ej: /tour/colosseum)'
    },
    {
      name: 'order',
      title: 'Orden',
      type: 'number',
      description: 'Orden de aparición (1, 2, 3...)',
      initialValue: 1
    },
    {
      name: 'active',
      title: 'Activo',
      type: 'boolean',
      description: 'Mostrar/ocultar esta tarjeta',
      initialValue: true
    }
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'location',
      media: 'image'
    }
  },
  orderings: [
    {
      title: 'Por orden',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }]
    },
    {
      title: 'Por nombre',
      name: 'nameAsc',
      by: [{ field: 'name', direction: 'asc' }]
    }
  ]
})