import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    // Forces Vitest's esbuild to use the React 17+ automatic JSX runtime,
    // preventing "React is not defined" in Next.js components during tests.
    jsx: "automatic",
  },
});