/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/dashboard/login',
        destination: '/dashboard',
        permanent: false,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'etzonmhbrmdiwblheesg.supabase.co' },
      { protocol: 'https', hostname: 'frenchbloomsoc.com' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['playwright', '@playwright/test'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'playwright', '@playwright/test']
    }
    return config
  },
}

export default nextConfig
