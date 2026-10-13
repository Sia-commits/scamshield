// Browser calls /api/...  ->  Next.js forwards it to your FastAPI server.
// This means no CORS setup is needed. Change BACKEND_URL when you deploy.
const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8001";

module.exports = {
  experimental: {
    proxyTimeout: 120000,
  },
  async rewrites() {
    return [
      { source: "/api/analyze/:path*", destination: `${BACKEND}/analyze/:path*` },
      { source: "/api/report", destination: `${BACKEND}/report` },
      { source: "/api/health", destination: `${BACKEND}/health` },
    ];
  },
};
