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
    // Root-level utility/test scripts (CommonJS, not part of app source)
    "*.js",
    // Claude Code worktrees live inside the project directory — never lint them
    ".claude/**",
  ]),
  {
    rules: {
      // Suppress react-hooks/set-state-in-effect for hydration fix pattern
      // This pattern is necessary to prevent hydration mismatches on Cart/Checkout pages
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
