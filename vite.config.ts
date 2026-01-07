import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // If building on GitHub Actions, infer the repo name so the same code works
  // for forks/renames without hardcoding the base path.
  const repo = process.env.GITHUB_REPOSITORY?.split("/")?.[1];
  const base = mode === "production" ? `/${repo ?? "database1"}/` : "/";

  return {
    base,
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
