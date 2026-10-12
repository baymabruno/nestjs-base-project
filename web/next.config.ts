import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // minimal server with only the files it needs (docker/Dockerfile.web)
  output: "standalone",
  images: {
    // hero images come small from the Steam CDN: no resizing needed
    unoptimized: true,
  },
};

export default nextConfig;
