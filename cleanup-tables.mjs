import { createClient } from '@sanity/client';

const client = createClient({
  projectId: 'kabmqky1',
  dataset: 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false
});

const tours = await client.fetch('*[_type == "post" && defined(body)]{_id, title, body}');
console.log(`Found ${tours.length} tours\n`);

let cleaned = 0;

for (const tour of tours) {
  const body = tour.body;
  if (!Array.isArray(body)) continue;

  const hasSlugTable = body.some(block => 
    block._type === 'simpleTable' && 
    block.rows?.some(row => 
      row.cells?.some(cell => cell?.includes?.('[SLUG:'))
    )
  );

  if (hasSlugTable) {
    const cleanBody = body.filter(block => {
      if (block._type !== 'simpleTable') return true;
      const hasSlugs = block.rows?.some(row => 
        row.cells?.some(cell => cell?.includes?.('[SLUG:'))
      );
      return !hasSlugs;
    });

    console.log(`Cleaning: ${tour.title} (${body.length} to ${cleanBody.length} blocks)`);
    
    await client.patch(tour._id).set({ body: cleanBody }).commit();
    cleaned++;
  }
}

console.log(`\nDone. Cleaned ${cleaned} tours`);
