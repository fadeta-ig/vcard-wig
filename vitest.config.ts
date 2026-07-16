import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      DATABASE_HOST: "127.0.0.1",
      DATABASE_PORT: "3307",
      DATABASE_USER: "root",
      DATABASE_PASSWORD: "",
      DATABASE_NAME: "vcard_wig_test",
      DATABASE_CONNECTION_LIMIT: "2",
      APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      SESSION_TTL_HOURS: "8",
    },
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts", "src/services/**/*.ts"],
    },
  },
  root: rootDirectory,
});
