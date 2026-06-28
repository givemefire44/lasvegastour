import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const d = await sanity.fetch(`*[_type=="post" && slug.current=="red-rock-canyon-heli-tour-with-landing-champagne"][0]{ "url":getYourGuideUrl }`);
console.log("URL cruda en Sanity:");
console.log(d.url);
