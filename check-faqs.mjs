import { createClient } from '@sanity/client';
const client = createClient({ projectId: '34ibxssl', dataset: 'production', apiVersion: '2024-01-01', token: process.env.SANITY_API_TOKEN, useCdn: false });
const r = await client.fetch('*[_type == "post"][0]{title, editorialRating, editorialReview, "faqCount": count(faqs), faqs}');
console.log(JSON.stringify(r, null, 2));
