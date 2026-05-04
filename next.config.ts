import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/filter-data": ["./data/**"],
    "/api/areas": ["./data/**"],
    "/api/trades": ["./data/**"],
  },
};

export default nextConfig;
