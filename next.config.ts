import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Doküman/fotoğraf yükleme için (madde 41/50). Excel import da bu limiti kullanır.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
