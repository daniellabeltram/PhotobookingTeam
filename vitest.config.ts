import { defineConfig } from "vitest/config";

// Unit and integration tests run on memory drivers with APP_ENV=test (docs/architecture.md section 4).
// QA may edit the include globs and setup files. Front-end DOM tests opt in with
// `// @vitest-environment happy-dom` at the top of the file.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    env: {
      APP_ENV: "test",
      STORE_DRIVER: "memory",
      EMAIL_DRIVER: "memory",
      RATE_LIMIT_DISABLED: "",
      LOG_LEVEL: "warn",
    },
    testTimeout: 20000,
  },
});
