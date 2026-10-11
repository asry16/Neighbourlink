import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Hide the development-only route indicator. Compile/runtime errors are
  // still surfaced by Next.js.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
