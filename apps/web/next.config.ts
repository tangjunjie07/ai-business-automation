import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.dify.ai',
      },
      // 加上你自己的服务器地址
      {
        protocol: 'http',
        hostname: '172.207.84.114',
        port: '3000',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
