/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {
      '@react-native-async-storage/async-storage': {
        browser: './empty-module.ts',
      },
      'pino-pretty': {
        browser: './empty-module.ts',
      },
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    }

    return config
  },
}

module.exports = nextConfig
