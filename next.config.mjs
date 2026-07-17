/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.rapidapi.com" },
      { protocol: "https", hostname: "**.p.rapidapi.com" },
      { protocol: "https", hostname: "d205bpvrqc9yn1.cloudfront.net" },
      { protocol: "https", hostname: "v2.exercisedb.io" },
    ],
  },
};

export default nextConfig;
