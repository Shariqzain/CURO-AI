/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed troika-* packages to prevent HMR injection into the Web Worker
  transpilePackages: ['reagraph', 'three', '@react-three/fiber', '@react-three/drei'],
  
  reactStrictMode: false, 
  swcMinify: false, 

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Keeps Webpack from defaulting to 'window' for async chunks
      config.output.globalObject = 'self';
    }
    return config;
  }
}

module.exports = nextConfig