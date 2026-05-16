import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/notices', destination: '/blog', permanent: true },
      { source: '/notices/:slug', destination: '/blog/:slug', permanent: true },
    ]
  },
  outputFileTracingIncludes: {
    "/api/filter-data": ["./data/**"],
    "/api/areas": ["./data/**"],
    "/api/trades": ["./data/**"],
    "/api/nearby-trades": ["./data/**"],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
    ],
  },
};

export default nextConfig;
