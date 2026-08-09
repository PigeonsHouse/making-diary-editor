import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Dockerfile worker source context", () => {
  const dockerfile = readFileSync(path.join(process.cwd(), "Dockerfile"), "utf8");
  const workerStage = dockerfile.split("FROM base AS worker")[1];
  const [beforeBundle, afterBundle] = workerStage.split("RUN pnpm worker:bundle");

  it("copies Remotion dependencies by responsibility folder before bundling", () => {
    expect(beforeBundle).toContain("COPY src/domain ./src/domain");
    expect(beforeBundle).toContain("COPY src/remotion ./src/remotion");
    expect(beforeBundle).toContain("COPY src/app/styles ./src/app/styles");
    expect(beforeBundle).toContain("COPY src/worker/remotion-bundle ./src/worker/remotion-bundle");
  });

  it("does not list individual source files and copies runtime sources after bundling", () => {
    expect(beforeBundle).not.toMatch(/^COPY src\/.*\.[a-z0-9]+(?:\s|$)/im);
    expect(afterBundle).toContain("COPY src ./src");
  });
});
