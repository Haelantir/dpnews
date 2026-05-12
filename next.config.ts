import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
