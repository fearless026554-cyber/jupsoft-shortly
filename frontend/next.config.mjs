/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/:tab(dashboard|overview|links|bulk|outcomes|qr|reports|analytics|tenants|users|domains|abuse|apikeys|profile|help)',
        destination: '/',
      },
    ];
  },
};

export default nextConfig;
