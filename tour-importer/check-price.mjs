import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local' });
import {createClient} from '@sanity/client';

const c = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

const tours = await c.fetch(`*[_type == "post" && bookingUrl match "gyg.me*" && !defined(getYourGuideUrl) && !(_id in path("drafts.**"))] | order(title asc){
  title, "slug": slug.current, bookingUrl
}`);

console.log("38 tours para completar manualmente:\n");
tours.forEach((t, i) => {
  console.log(`${i + 1}. ${t.title}`);
  console.log(`   Slug: ${t.slug}`);
  console.log(`   Short: ${t.bookingUrl}\n`);
});
