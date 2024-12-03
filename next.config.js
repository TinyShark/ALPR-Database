/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static configuration for output tracing
  outputFileTracingIncludes: {
    "/**": [
      "/.next",
      "/public",
      "/app",
      "/lib",
      "/components",
      "/config",
      "/middleware.js",
      "/hooks",
      "/auth",
      "/package.json",
    ],
  },
  // Add these configurations for better asset handling
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
  // Ensure images are handled correctly with base path
  images: {
    unoptimized: true, // For static exports
  },
  // Webpack configuration for better module handling
  webpack: (config, { isServer }) => {
    // Add any webpack customizations if needed
    return config;
  },
};

module.exports = nextConfig;