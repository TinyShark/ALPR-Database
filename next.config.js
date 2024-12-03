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
};

module.exports = nextConfig;