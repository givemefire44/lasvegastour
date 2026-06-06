// sanity/schemaTypes/destinationCard.ts
import { defineType } from 'sanity'

export default defineType({
  name: 'destinationCard',
  title: 'Destination Cards',
  type: 'document',
  icon: () => '📍',
  fields: [
    {
      name: 'nombre',
      title: 'Nombre',
      type: 'string',
      description: 'Nombre del destino'
    },
    {
      name: 'image',
      title: 'Imagen',
      type: 'image',
      description: 'Imagen del destino (recomendado: 600x400px)',
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
      description: 'Link al destino (ej: /tours/cordoba)'
    },
    {
      name: 'order',
      title: 'Orden',
      type: 'number',
      description: 'Orden en el masonry layout (1, 2, 3...)',
      initialValue: 1
    },
    {
      name: 'active',
      title: 'Activo',
      type: 'boolean',
      description: 'Mostrar/ocultar este destino',
      initialValue: true
    }
  ],
  preview: {
    select: {
      title: 'nombre',
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
      name: 'nombreAsc',
      by: [{ field: 'nombre', direction: 'asc' }]
    }
  ]
})