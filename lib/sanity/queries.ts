import { groq } from "next-sanity";

export const homePageQuery = groq`*[_id == "homePage"][0]{
  heroLines[]{ strong, muted },
  heroIntro
}`;

export const aboutPageQuery = groq`*[_id == "aboutPage"][0]{
  headline,
  portrait{ alt, asset, hotspot, crop },
  biography,
  expertise,
  contactText
}`;

export const projectsQuery = groq`*[_type == "project" && isHidden != true] | order(order asc, _createdAt asc){
  _id,
  title,
  "slug": slug.current,
  projectType,
  description,
  link,
  linkLabel,
  "images": images[defined(asset)]{
    _key,
    alt,
    "source": { "_type": "image", "asset": asset, "hotspot": hotspot, "crop": crop },
    "width": asset->metadata.dimensions.width,
    "height": asset->metadata.dimensions.height
  }
}`;
