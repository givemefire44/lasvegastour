import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});
import {createClient} from '@sanity/client';
const c = createClient({projectId:process.env.SANITY_PROJECT_ID,dataset:process.env.SANITY_DATASET,token:process.env.SANITY_TOKEN,apiVersion:'2024-01-01',useCdn:false});
const r = await c.fetch('*[_type=="post"][0]{title,"img1":mainImage.asset->url,"img2":heroGallery[0].asset->url}');
console.log(r);
