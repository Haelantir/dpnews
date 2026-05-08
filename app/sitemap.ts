import { MetadataRoute } from 'next';

const BASE_URL = 'https://seoulowner.co.kr';

export default function sitemap(): MetadataRoute.Sitemap {
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
      url: `${BASE_URL}/notices`,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ];
}
