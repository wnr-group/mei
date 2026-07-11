import type { NextConfig } from "next";

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

// next.config.ts

const nextConfig: NextConfig = {
  images: {
    unoptimized: process.env.NODE_ENV === "development",
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
        protocol: 'https',
        hostname: 'rmkv.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn3.gstatic.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

