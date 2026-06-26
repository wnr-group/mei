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

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: supabaseProtocol,
        hostname: supabaseHostname,
        port: supabasePort || undefined,
      },
    ],
  },
};

export default nextConfig;

