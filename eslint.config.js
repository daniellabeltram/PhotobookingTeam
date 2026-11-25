import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/**", ".data/**", "node_modules/**", "test-results/**", "playwright-report/**", ".netlify/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "separate-type-imports" }],
      "no-console": "error", // only netlify/lib/log.ts may print (review M3)
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Use h() from src/lib/dom.ts (textContent only)." },
        { property: "outerHTML", message: "Use h() from src/lib/dom.ts (textContent only)." },
        { property: "insertAdjacentHTML", message: "Use h() from src/lib/dom.ts (textContent only)." },
      ],
      // Luxon is allowed in exactly one file (ADR 0006). Business times never go through Date parsing elsewhere.
      "no-restricted-imports": ["error", { paths: [{ name: "luxon", message: "Import time helpers from shared/datetime.ts (ADR 0006)." }] }],
    },
  },
  {
    // shared/ is browser-safe: no server code and no config/ (review L2).
    files: ["shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "luxon", message: "Import time helpers from shared/datetime.ts (ADR 0006)." }],
          patterns: [{ group: ["**/config/*", "**/config/**", "**/netlify/**", "node:*"], message: "shared/ must stay browser-safe: no config/, no netlify/, no node: modules." }],
        },
      ],
    },
  },
  {
    files: ["shared/datetime.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["**/config/**", "**/netlify/**", "node:*"], message: "shared/ must stay browser-safe." }] }],
    },
  },
  {
    // The browser never imports config/ (ADR 0007): it calls GET /api/config.
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "luxon", message: "Import time helpers from shared/datetime.ts (ADR 0006)." }],
          patterns: [{ group: ["**/config/*", "**/config/**", "**/netlify/**"], message: "The browser must not import server code or config/. Call /api/config." }],
        },
      ],
    },
  },
  { files: ["netlify/lib/log.ts", "scripts/**/*.ts", "tests/**/*.ts", "e2e/**/*.ts"], rules: { "no-console": "off" } },
  {
    // Tests may use innerHTML-free DOM too, but they poke at test doubles and loose types.
    files: ["tests/**/*.ts", "e2e/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-non-null-assertion": "off" },
  },
);
