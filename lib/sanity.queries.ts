import { groq } from 'next-sanity'

export const noticesQuery = groq`
  *[_type == "notice"] | order(publishedAt desc) {
    _id, title, slug, publishedAt, excerpt,
    mainImage { asset->{ url, metadata { dimensions } } }
  }
`

export const noticeBySlugQuery = groq`
  *[_type == "notice" && slug.current == $slug][0] {
    _id, title, slug, publishedAt, excerpt,
    mainImage { asset->{ url, metadata { dimensions } }, alt },
    body[] {
      ...,
      _type == "image" => {
        ...,
        asset->{ url, metadata { dimensions } }
      }
    }
  }
`
