import {createClient} from "@sanity/client";
const c = createClient({projectId:process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,dataset:"production",apiVersion:"2024-01-01",token:process.env.SANITY_API_TOKEN,useCdn:false});
const pages = await c.fetch('*[_type=="page"]{"slug":slug.current,title}|order(title asc)');
pages.forEach(p => console.log(p.slug + " => " + p.title));
