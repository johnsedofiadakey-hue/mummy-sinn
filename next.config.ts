import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Admin-uploaded food/promotion images (public/menu-images, public/promotions in Firebase Storage).
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/**" },
    ],
  },
};

export default nextConfig;
