import {createClient} from "@sanity/client";
const c = createClient({projectId:process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,dataset:"production",apiVersion:"2024-01-01",token:process.env.SANITY_API_TOKEN,useCdn:false});
const tours = await c.fetch('*[_type=="post" && !(_id in path("drafts.**"))]{title}|order(title asc)');
tours.forEach(t => console.log(t.title));
