import path from "node:path";
import { ensureBrowser } from "@remotion/renderer";
import { bundleRemotion } from ".";

const output = path.resolve(process.env.REMOTION_BUNDLE_DIR ?? ".remotion-bundle");

async function main() {
  await Promise.all([bundleRemotion(output), ensureBrowser({ chromeMode: "chrome-for-testing" })]);
  console.log(`Remotion bundle created at ${output}; Chrome for Testing is ready`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
