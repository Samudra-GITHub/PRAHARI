import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Keep packages that ship WASM/native code outside the Next.js bundler.
  // Without this, Next.js's module polyfills (URL, fs, etc.) clash with
  // the packages' expectations and PGlite fails to initialise with
  // "The "path" argument must be of type string or an instance of Buffer
  // or URL. Received an instance of URL".
  serverExternalPackages: [
    '@electric-sql/pglite',
    '@prisma/client',
    '@prisma/config',
    'prisma-pglite',
    'pg',
    'pg-mem',
    'jose',
    'bcryptjs',
  ],
};

export default nextConfig;
