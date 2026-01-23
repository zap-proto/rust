/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/capnp-rust',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
