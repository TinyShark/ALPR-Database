/** @type {import('next').NextConfig} */
const { getConfig } = require('./lib/settings');

async function getNextConfig() {
  const config = await getConfig();
  return {
    basePath: config.homeassistant?.basePath || "",
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
}

module.exports = getNextConfig();
