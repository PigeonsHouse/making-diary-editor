import path from "node:path";
import { access } from "node:fs/promises";
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

export async function getRemotionServeUrl(prebuiltDir = process.env.REMOTION_BUNDLE_DIR) {
  if (prebuiltDir) {
    try {
      await access(path.join(prebuiltDir, "index.html"));
      return prebuiltDir;
    } catch {
      // 開発環境など、事前バンドルがない場合だけ実行時に生成する。
    }
  }
  return bundleRemotion();
}
