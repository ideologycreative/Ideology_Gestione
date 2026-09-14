import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // A sibling project's package-lock.json one level up (outside this
    // repo) otherwise makes Turbopack guess the workspace root wrong.
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
