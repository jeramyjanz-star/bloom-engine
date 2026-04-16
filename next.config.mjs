/** @type {import('next').NextConfig} */
const nextConfig = {
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
