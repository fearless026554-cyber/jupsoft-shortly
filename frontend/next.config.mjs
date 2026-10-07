/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/overview',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/analytics',
        destination: '/reports',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
