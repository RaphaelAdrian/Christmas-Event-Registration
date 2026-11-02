import type { NextConfig } from "next";

// Gallery photos are served from the project's public Supabase Storage bucket
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

const nextConfig: NextConfig = {
  // This folder is the project root, even if a parent folder has its own lockfile
  outputFileTracingRoot: process.cwd(),
  // ExcelJS runs on the server only (Excel export and invite import)
  serverExternalPackages: ["exceljs"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/gallery/**" }],
  },
  experimental: {
    serverActions: {
      // Invite list files (Excel/CSV) are sent to a server action
      bodySizeLimit: "3mb",
    },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
