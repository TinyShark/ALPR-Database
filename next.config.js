/** @type {import('next').NextConfig} */
const { getConfig } = require('./lib/settings');

const nextConfig = {
  // Get the base path from settings
  async rewrites() {
    const config = await getConfig();
    const basePath = config.homeassistant?.basePath || '';
    
    return {
      beforeFiles: [
        {
          source: '/_next/:path*',
          destination: `${basePath}/_next/:path*`,
        },
      ],
    };
  },
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