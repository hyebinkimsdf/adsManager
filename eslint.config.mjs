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
  ]),
  {
    // Node's test runner and the TS require-hook it uses are plain CommonJS by design.
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Emotion's documented theme-typing pattern (https://emotion.sh/docs/typescript#define-a-theme)
    // requires an empty `interface Theme extends AppTheme {}` so declaration merging augments
    // @emotion/react's own Theme interface — a type alias would not merge the same way.
    files: ["lib/theme/emotion.d.ts"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
]);

export default eslintConfig;
