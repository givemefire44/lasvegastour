import { createClient } from 'next-sanity'

import { apiVersion, dataset, projectId } from '../env'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  // ✅ CORREGIDO: Solo usar revalidate, no cache conflictivo
  fetch: { 
    next: { revalidate: 60 } // Cache por 60 segundos
  },
  requestTagPrefix: 'nextjs15',
  ignoreBrowserTokenWarning: true
})

// 🎯 ALTERNATIVA SI QUERÉS DIFERENTE CACHE POR QUERY:
export const clientNoCache = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  fetch: { 
    cache: 'no-store' // Solo para queries que necesiten data fresh
  },
  requestTagPrefix: 'nextjs15',
  ignoreBrowserTokenWarning: true
})