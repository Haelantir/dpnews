import { MetadataRoute } from 'next';
import { client } from '@/lib/sanity.client';

const BASE_URL = 'https://seoulowner.co.kr';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts: { slug: { current: string }; publishedAt: string }[] = await client.fetch(
    `*[_type == "notice"] | order(publishedAt desc) { slug, publishedAt }`
  );

  const postUrls: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug.current}`,
    lastModified: post.publishedAt ? new Date(post.publishedAt) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/trades`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/new-highs`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/unusual-trades`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/top-apts`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/seoul-ranking`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/budget-apts`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/blog`,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    ...postUrls,
  ];
}
