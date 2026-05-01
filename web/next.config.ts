import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产环境使用直连后端，不使用代理 rewrites
  ...(process.env.NEXT_PUBLIC_API_URL
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: 'http://localhost:8000/api/:path*',
            },
          ];
        },
      }),
};

export default nextConfig;
