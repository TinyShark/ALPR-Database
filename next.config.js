/** @type {import('next').NextConfig} */
const { getConfig } = require('./lib/settings');

const nextConfig = {
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

// Initialize config with base path
if (getConfig && typeof getConfig === 'function') {
  const config = getConfig();
  if (config.homeassistant?.basePath) {
    nextConfig.basePath = config.homeassistant.basePath;
  }
}

module.exports = nextConfig;
