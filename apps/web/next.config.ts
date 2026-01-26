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
      {
        protocol: 'http',
        hostname: '172.207.84.114',
        port: '3000',
        pathname: '/**',
      },
    ],
  },
  // 🚀 核心新增：将 /files 路径的请求转发到 Dify 容器
  async rewrites() {
    return [
      {
        // 浏览器请求的路径
        source: '/files/:path*',
        // 实际获取数据的内网地址（注意：Dify 的文件接口不带 /v1）
        destination: 'http://docker-api-1:5001/files/:path*',
      },
    ];
  },
};

export default nextConfig;