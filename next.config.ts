import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The ChatGPT-app panel is read from disk by app/mcp/[secret]/route.ts — make sure the
  // serverless bundle ships it ("/mcp/**" matches the route "/mcp/[secret]").
  outputFileTracingIncludes: {
    "/mcp/**": ["./mcp/panel.html"],
  },
};

export default nextConfig;
