// sanity/schemaTypes/geoDestination.ts
// Distancia y tiempo de manejo desde el Strip, POR DESTINO (no por tour).
// Los tours no se tocan: el vinculo tour -> destino vive en data/tour-destinations.json.
// Las cifras se citan textuales en la linea del template y en el JSON-LD: se miden, no se estiman.
import { defineType, defineField } from 'sanity'

export const geoDestinationType = defineType({
  name: 'geoDestination',
  title: 'Geo Destinations',
  type: 'document',
  icon: () => '🧭',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Como se nombra en la linea del tour. Ej: "Valley of Fire"',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'destinationId',
      title: 'Destination ID',
      type: 'slug',
      description: 'Clave que usa data/tour-destinations.json. No cambiarla.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'point',
      title: 'Measured point',
      type: 'string',
      description: 'El punto exacto medido. Ej: "Valley of Fire Visitor Center"',
    }),
    defineField({ name: 'lat', title: 'Latitude', type: 'number', validation: (r) => r.required().min(-90).max(90) }),
    defineField({ name: 'lng', title: 'Longitude', type: 'number', validation: (r) => r.required().min(-180).max(180) }),
    defineField({
      name: 'milesFromStrip',
      title: 'Miles from the Strip',
      type: 'number',
      description: 'Desde 3600 S Las Vegas Blvd (Bellagio), ruta mas rapida.',
      validation: (r) => r.required().positive(),
    }),
    defineField({
      name: 'driveMinutesOneWay',
      title: 'Drive time one way (minutes)',
      type: 'number',
      description: 'Trafico liviano, redondeado a 5 min.',
      validation: (r) => r.required().positive().integer(),
    }),
    defineField({
      name: 'direction',
      title: 'Direction from the Strip',
      type: 'string',
      description: 'Rumbo de 16 puntos. Ej: "east-northeast"',
    }),
    defineField({
      name: 'altRoute',
      title: 'Alternate route (closure / detour)',
      type: 'object',
      description: 'Solo si hay un desvio vigente. Ej: Valley of Fire lun-jue por la entrada este.',
      fields: [
        defineField({ name: 'label', title: 'When it applies', type: 'string', description: 'Ej: "Monday to Thursday, while the West Entrance is closed"' }),
        defineField({ name: 'miles', title: 'Miles', type: 'number' }),
        defineField({ name: 'minutes', title: 'Minutes one way', type: 'number' }),
        defineField({ name: 'until', title: 'Expected until', type: 'date' }),
      ],
    }),
    defineField({ name: 'measuredAt', title: 'Measured on', type: 'date', validation: (r) => r.required() }),
    defineField({ name: 'source', title: 'Source', type: 'text', rows: 3 }),
  ],
  preview: {
    select: { title: 'name', mi: 'milesFromStrip', min: 'driveMinutesOneWay' },
    prepare: ({ title, mi, min }) => ({ title, subtitle: `${mi} mi · ${min} min` }),
  },
})
