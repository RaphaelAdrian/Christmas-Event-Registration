import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ExcelJS runs on the server only (Excel export and invite import)
  serverExternalPackages: ["exceljs"],
  experimental: {
    serverActions: {
      // Invite list files (Excel/CSV) are sent to a server action
      bodySizeLimit: "3mb",
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
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
