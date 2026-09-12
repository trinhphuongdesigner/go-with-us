import type { NextConfig } from "next";

const allowedDevOrigins = (process.env.CAREERMATE_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async rewrites() {
    const apiProxyTarget = process.env.CAREERMATE_API_PROXY_TARGET ?? "http://127.0.0.1:8140";

    return [
      {
        source: "/api/v2/:path*",
        destination: `${apiProxyTarget}/api/v2/:path*`,
      },
    ];
  },
};

export default nextConfig;
