// app/sitemap.ts - VERSION CON PAGE CATEGORIES

import { MetadataRoute } from 'next'
import { client } from '@/sanity/lib/client'

type SitemapEntry = {
  url: string
  lastModified?: string | Date
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://lasvegastour.com'
  
  console.log('🔍 SITEMAP EJECUTÁNDOSE - GENERANDO URLs...')
  
  try {
    const data = await client.fetch(`
      {
       "posts": *[_type == "post" && discontinued != true]{
          "slug": slug.current,
          "_updatedAt": _updatedAt,
          "_createdAt": _createdAt,
          "title": title,
          "_id": _id,
          "hasSlug": defined(slug.current)
        },
        "pages": *[_type == "page"]{
          "slug": slug.current,
          "_updatedAt": _updatedAt,
          "_createdAt": _createdAt,
          "title": title,
          "_id": _id,
          "hasSlug": defined(slug.current)
        },
        "categories": *[_type == "category"]{
          "slug": slug.current,
          "_updatedAt": _updatedAt,
          "_createdAt": _createdAt,
          "title": title,
          "_id": _id,
          "hasSlug": defined(slug.current)
        },
        "pageCategories": *[_type == "pageCategory"]{
          "slug": slug.current,
          "_updatedAt": _updatedAt,
          "_createdAt": _createdAt,
          "title": title,
          "_id": _id,
          "hasSlug": defined(slug.current)
        }
      }
    `)

    // 🔍 DEBUG
    console.log('📊 DATOS RECIBIDOS DE SANITY:')
    console.log(`🏛️ Posts totales: ${data.posts?.length || 0}`)
    console.log(`📁 Categories (tours): ${data.categories?.length || 0}`)
    console.log(`📄 Pages totales: ${data.pages?.length || 0}`)
    console.log(`📂 Page Categories: ${data.pageCategories?.length || 0}`)

    const postsWithoutSlug = data.posts?.filter((p: any) => !p.hasSlug) || []
    const pagesWithoutSlug = data.pages?.filter((p: any) => !p.hasSlug) || []
    const categoriesWithoutSlug = data.categories?.filter((c: any) => !c.hasSlug) || []
    const pageCategoriesWithoutSlug = data.pageCategories?.filter((pc: any) => !pc.hasSlug) || []

    if (postsWithoutSlug.length > 0) {
      console.log('⚠️ Posts SIN SLUG:', postsWithoutSlug.map((p: any) => `${p.title} (${p._id})`))
    }
    if (pagesWithoutSlug.length > 0) {
      console.log('⚠️ Pages SIN SLUG:', pagesWithoutSlug.map((p: any) => `${p.title} (${p._id})`))
    }
    if (categoriesWithoutSlug.length > 0) {
      console.log('⚠️ Categories SIN SLUG:', categoriesWithoutSlug.map((c: any) => `${c.title} (${c._id})`))
    }
    if (pageCategoriesWithoutSlug.length > 0) {
      console.log('⚠️ Page Categories SIN SLUG:', pageCategoriesWithoutSlug.map((pc: any) => `${pc.title} (${pc._id})`))
    }

    const sitemap: SitemapEntry[] = []

    // 🏠 HOME
    sitemap.push({
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0
    })
// 🎯 TOUR FINDER
sitemap.push({
  url: `${baseUrl}/tour-finder`,
  lastModified: new Date(),
  changeFrequency: 'weekly',
  priority: 0.85
})
// 🗂️ TOURS INDEX (grilla de categorías)
sitemap.push({
  url: `${baseUrl}/tours`,
  lastModified: new Date(),
  changeFrequency: 'weekly',
  priority: 0.9
})


    // 🏛️ TOURS/POSTS
    if (data.posts) {
      const validPosts = data.posts.filter((post: any) => post.slug && post.slug.trim() !== '')
      console.log(`✅ Posts válidos: ${validPosts.length}`)

      validPosts.forEach((post: any) => {
        const url = `${baseUrl}/tour/${post.slug}`
        console.log(`🔗 Agregando tour: ${url}`)
        sitemap.push({
          url,
          lastModified: new Date(post._updatedAt || post._createdAt),
          changeFrequency: 'weekly',
          priority: 0.9
        })
      })
    }

    // 📁 CATEGORÍAS DE TOURS
    if (data.categories) {
      const validCategories = data.categories.filter((cat: any) => cat.slug && cat.slug.trim() !== '')
      console.log(`✅ Categories válidas: ${validCategories.length}`)

      validCategories.forEach((category: any) => {
        const url = `${baseUrl}/tours/${category.slug}`
        console.log(`🔗 Agregando categoría: ${url}`)
        sitemap.push({
          url,
          lastModified: new Date(category._updatedAt || category._createdAt),
          changeFrequency: 'weekly',
          priority: 0.8
        })
      })
    }

    // 📂 PAGE CATEGORIES (agrupadores de páginas estáticas)
    if (data.pageCategories) {
      const validPageCategories = data.pageCategories.filter((pc: any) => pc.slug && pc.slug.trim() !== '')
      console.log(`✅ Page Categories válidas: ${validPageCategories.length}`)

      validPageCategories.forEach((pageCat: any) => {
        const url = `${baseUrl}/pages/${pageCat.slug}`
        console.log(`🔗 Agregando page category: ${url}`)
        sitemap.push({
          url,
          lastModified: new Date(pageCat._updatedAt || pageCat._createdAt),
          changeFrequency: 'weekly',
          priority: 0.7
        })
      })
    }

    // 📄 PÁGINAS ESTÁTICAS (flat)
    if (data.pages) {
      const validPages = data.pages.filter((page: any) => page.slug && page.slug.trim() !== '')
      console.log(`✅ Pages válidas: ${validPages.length}`)

      validPages.forEach((page: any) => {
        let priority = 0.7
        let changeFreq: SitemapEntry['changeFrequency'] = 'monthly'

        if (page.slug === 'tips') {
          priority = 0.8
          changeFreq = 'weekly'
        } else if (page.slug === 'about' || page.slug === 'contact') {
          priority = 0.5
          changeFreq = 'yearly'
        }

        const url = `${baseUrl}/${page.slug}`
        console.log(`🔗 Agregando página: ${url}`)
        sitemap.push({
          url,
          lastModified: new Date(page._updatedAt || page._createdAt),
          changeFrequency: changeFreq,
          priority: priority
        })
      })
    }
     // 🏛️ HUB PAGES
     const hubData = require('@/data/tourHubs.json');
     if (hubData?.hubs) {
       hubData.hubs.forEach((hub: any) => {
         const url = `${baseUrl}/${hub.slug}`
         console.log(`🔗 Agregando hub: ${url}`)
         sitemap.push({
           url,
           lastModified: new Date(),
           changeFrequency: 'weekly',
           priority: 0.85
         })
       })
       console.log(`✅ Hubs válidos: ${hubData.hubs.length}`)
     }

    // 📊 RESUMEN
    console.log(`🎯 SITEMAP GENERADO:`)
    console.log(`📊 Total URLs: ${sitemap.length}`)
    console.log(`🏠 Home: 1`)
    console.log(`🏛️ Tours: ${data.posts?.filter((p: any) => p.slug).length || 0}`)
    console.log(`📁 Tour Categories: ${data.categories?.filter((c: any) => c.slug).length || 0}`)
    console.log(`📂 Page Categories: ${data.pageCategories?.filter((pc: any) => pc.slug).length || 0}`)
    console.log(`📄 Pages: ${data.pages?.filter((p: any) => p.slug).length || 0}`)

    console.log('🔗 URLs GENERADAS:')
    sitemap.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.url}`)
    })

    return sitemap

  } catch (error) {
    console.error('❌ Error generating sitemap:', error)

    return [{
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0
    }]
  }
}

   

export const revalidate = 86400