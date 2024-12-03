/** @type {import('next').NextConfig} */
const { getConfig } = require('./lib/settings');

module.exports = async () => {
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
};
