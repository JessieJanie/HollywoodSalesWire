import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // Imported upstream suite uses node:test; run it via test:founding-deadline.
    exclude: ["src/lib/foundingDeadline.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
