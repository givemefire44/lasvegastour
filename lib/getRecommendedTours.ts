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
      getYourGuideData{ rating, reviewCount }
    }`,
    excludeSlug ? { excludeSlug } : {},
    { next: { revalidate: 300 } }
  );
}