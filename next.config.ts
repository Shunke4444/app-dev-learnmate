import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // Heavy browser-only deps (loaded via dynamic import in client components)
  // must not be traced into serverless function bundles, or Vercel will hit the
  // 250 MB unzipped limit.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@huggingface/**/*",
      "node_modules/pdfjs-dist/**/*",
      "node_modules/@prisma/engines/**/*",
      "node_modules/@prisma/studio-core/**/*",
      "node_modules/@prisma/dev/**/*",
      "node_modules/@prisma/query-plan-executor/**/*",
      "node_modules/@prisma/fetch-engine/**/*",
      "node_modules/@prisma/client/runtime/library.d.ts",
      "node_modules/@prisma/client/runtime/*.wasm*",
      "node_modules/@swc/**/*",
      "node_modules/typescript/**/*",
      "node_modules/**/*.map",
      "node_modules/**/*.md",
      "node_modules/**/LICENSE*",
      "node_modules/**/test/**/*",
      "node_modules/**/tests/**/*",
      "node_modules/**/.bin/**/*",
    ],
  },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
