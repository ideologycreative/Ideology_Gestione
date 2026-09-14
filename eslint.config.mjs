import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // legacy/ is the old vanilla-JS prototype, kept for reference during
    // the Phase B/C port — not part of this app, not worth linting.
    "legacy/**",
    "docs/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
