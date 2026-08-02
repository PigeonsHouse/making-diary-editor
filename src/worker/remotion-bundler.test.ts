import path from "node:path";
import { describe, expect, it } from "vitest";
import { configureRemotionWebpack } from "./remotion-bundler";

describe("configureRemotionWebpack", () => {
  it("keeps existing aliases and resolves the project alias from src", () => {
    const configured = configureRemotionWebpack({ resolve: { alias: { existing: "/existing" } } });

    expect(configured.resolve?.alias).toEqual({
      existing: "/existing",
      "@": path.join(process.cwd(), "src"),
    });
  });
});
