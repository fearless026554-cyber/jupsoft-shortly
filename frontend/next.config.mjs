/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/:tab(links|bulk|outcomes|qr|reports|analytics|tenants|users|domains|abuse|apikeys|profile|help)',
        destination: '/',
      },
    ];
  },
};

export default nextConfig;
