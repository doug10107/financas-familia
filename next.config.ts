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
  allowedDevOrigins: ['192.168.68.133'],
} as any;

export default nextConfig;
