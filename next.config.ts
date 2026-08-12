import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config: any) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      canvas: './src/lib/empty-module.js',
    },
  },
} as any;

export default nextConfig;
