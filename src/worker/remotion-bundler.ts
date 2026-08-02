import path from "node:path";
import { bundle, type WebpackConfiguration } from "@remotion/bundler";

export function configureRemotionWebpack(config: WebpackConfiguration): WebpackConfiguration {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        "@": path.join(process.cwd(), "src"),
      },
    },
  };
}

export function bundleRemotion(outDir?: string) {
  return bundle({
    entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    webpackOverride: configureRemotionWebpack,
    ...(outDir ? { outDir } : {}),
  });
}
