// lib/getRecommendedTours.ts
import { client } from '@/sanity/lib/client';

export async function getRecommendedTours(excludeSlug?: string) {
  const filter = excludeSlug ? '&& slug.current != $excludeSlug' : '';
  return await client.fetch(
    `*[_type == "post" && discontinued != true ${filter}]{
      _id,
      title,
      slug,
      "categorySlug": category->slug.current,
      mainImage{ asset->{ url }, alt },
      "heroGallery": heroGallery[0..0]{ asset->{ url }, alt },
      "body": body[0...1],
      getYourGuideData{ rating, reviewCount },
      // Lo que el widget del sidebar necesita para pintar una tarjeta y salir
      // al partner sin pasar por la pagina del tour. Sin bookingUrl el widget
      // se queda sin tours y devuelve null, o sea que falla en silencio.
      bookingUrl,
      getYourGuideUrl,
      "precio": tourInfo.price,
      "duracion": tourInfo.duration,
      "rating": getYourGuideData.rating,
      "reviews": getYourGuideData.reviewCount
    }`,
    excludeSlug ? { excludeSlug } : {},
    { next: { revalidate: 300 } }
  );
}