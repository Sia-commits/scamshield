// Browser calls /api/... -> Next.js forwards it to your FastAPI server.
const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

module.exports = {
  experimental: {
    proxyTimeout: 120000,
  },
  async rewrites() {
    return [
      { source: "/api/analyze/:path*", destination: `${BACKEND}/analyze/:path*` },
      { source: "/api/report", destination: `${BACKEND}/report` },
      { source: "/api/history", destination: `${BACKEND}/history` },
      { source: "/api/history/:path*", destination: `${BACKEND}/history/:path*` },
      { source: "/api/health", destination: `${BACKEND}/health` },
    ];
  },
};

