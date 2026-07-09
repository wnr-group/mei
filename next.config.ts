import type { NextConfig } from "next";
import path from "path";

let supabaseHostname = "hjhqemsyufsifmgespur.supabase.co";
let supabaseProtocol: "http" | "https" = "https";
let supabasePort = "";

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const parsed = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    supabaseHostname = parsed.hostname;
    supabaseProtocol = parsed.protocol === "http:" ? "http" : "https";
    supabasePort = parsed.port;
  } catch {
    // Ignore malformed URL
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: supabaseProtocol,
        hostname: supabaseHostname,
        port: supabasePort || undefined,
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        // Shopify-hosted product images (e.g. dollyjstudio.com CDN)
        protocol: "https",
        hostname: "*.myshopify.com",
      },
      {
        protocol: "https",
        hostname: "dollyjstudio.com",
      },
      {
        protocol: "https",
        hostname: "rmkv.com",
      },
      {
        // Google Shopping / gstatic image thumbnails (encrypted-tbn*.gstatic.com, etc.)
        protocol: "https",
        hostname: "*.gstatic.com",
      },
    ],
  },
  turbopack: {
    // Pin workspace root so Next.js doesn't infer from a parent lockfile
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
