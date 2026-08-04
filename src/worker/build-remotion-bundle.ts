import path from "node:path";
import { bundleRemotion } from "./remotion-bundler";

const output = path.resolve(process.env.REMOTION_BUNDLE_DIR ?? ".remotion-bundle");

void bundleRemotion(output)
  .then(() => console.log(`Remotion bundle created at ${output}`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
