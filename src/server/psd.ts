import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { initializeCanvas, readPsd, type Layer } from "ag-psd";
import { PNG } from "pngjs";
import sharp from "sharp";

const PSD_PREVIEW_MAX_DIMENSION = 1200;
const PSD_RENDER_VERSION = `multiply-v2-max-${PSD_PREVIEW_MAX_DIMENSION}`;

initializeCanvas(
  () => {
    throw new Error("Canvas rendering is not used by PSD preview generation.");
  },
  (width, height) =>
    ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }) as ImageData,
);

export type PsdTreeNode = {
  path: string;
  name: string;
  type: "group" | "layer";
  children: PsdTreeNode[];
};

export type PsdFilters = Record<
  string,
  {
    targets: string[];
    choiceOrder?: string[];
    choices: Record<string, { show: string[]; hide?: string[] }>;
  }
>;

const nameOf = (layer: Layer) => (layer.name ?? "名称なし").replace(/^[/!\*]+/, "");

export async function readPsdTree(filePath: string): Promise<PsdTreeNode[]> {
  const psd = readPsd(await readFile(filePath), {
    skipLayerImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
    skipLinkedFilesData: true,
  });
  const walk = (layers: Layer[], parents: string[]): PsdTreeNode[] =>
    layers.map((layer) => {
      const current = [...parents, nameOf(layer)];
      return {
        path: current.join("/"),
        name: nameOf(layer),
        type: layer.children ? "group" : "layer",
        children: layer.children ? walk(layer.children, current) : [],
      };
    });
  return walk(psd.children ?? [], []);
}

export async function renderPsdPreview(
  filePath: string,
  filters: PsdFilters,
  selections: Record<string, string>,
  outputDir: string,
  sourceFingerprint?: string,
) {
  const sourceForHash = sourceFingerprint ? Buffer.from(sourceFingerprint) : await readFile(filePath);
  const hash = createHash("sha256")
    .update(PSD_RENDER_VERSION)
    .update(sourceForHash)
    .update(JSON.stringify({ filters, selections }))
    .digest("hex");
  const outputPath = path.join(outputDir, `${hash}.png`);
  try {
    await access(outputPath);
    return hash;
  } catch {
    // キャッシュがない組み合わせだけPSDを合成する。
  }
  const source = sourceFingerprint ? await readFile(filePath) : sourceForHash;
  const psd = readPsd(source, {
    skipCompositeImageData: true,
    skipThumbnail: true,
    skipLinkedFilesData: true,
    useImageData: true,
  });
  const output = new Uint8ClampedArray(psd.width * psd.height * 4);
  const draw = (layer: Layer) => {
    if (!layer.imageData) return;
    const data = layer.imageData.data;
    const width = layer.imageData.width;
    const height = layer.imageData.height;
    const left = layer.left ?? 0;
    const top = layer.top ?? 0;
    const opacity = Math.max(0, Math.min(1, layer.opacity ?? 1));
    const multiply = layer.blendMode === "multiply" || /[（(]乗算[)）]/.test(layer.name ?? "");
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const dx = left + x;
        const dy = top + y;
        if (dx < 0 || dy < 0 || dx >= psd.width || dy >= psd.height) continue;
        const si = (y * width + x) * 4;
        const di = (dy * psd.width + dx) * 4;
        const sa = (data[si + 3] / 255) * opacity;
        const da = output[di + 3] / 255;
        const oa = sa + da * (1 - sa);
        if (oa === 0) continue;
        for (let c = 0; c < 3; c++) {
          const sourceColor = data[si + c] / 255;
          const destinationColor = output[di + c] / 255;
          const blendedColor = multiply ? sourceColor * destinationColor : sourceColor;
          const premultiplied = sa * (1 - da) * sourceColor + sa * da * blendedColor + (1 - sa) * da * destinationColor;
          output[di + c] = Math.round((premultiplied / oa) * 255);
        }
        output[di + 3] = Math.round(oa * 255);
      }
  };
  const hiddenPrefixes: string[] = [];
  const visiblePrefixes: string[] = [];
  for (const [filterName, filter] of Object.entries(filters)) {
    const choice = filter.choices[selections[filterName]];
    if (!choice) continue;
    hiddenPrefixes.push(...filter.targets, ...(choice.hide ?? []));
    visiblePrefixes.push(...choice.show);
  }
  const matches = (pathValue: string, prefixes: string[]) =>
    prefixes.some((prefix) => pathValue === prefix || pathValue.startsWith(`${prefix}/`));
  const hasVisibleChild = (pathValue: string) => visiblePrefixes.some((prefix) => prefix.startsWith(`${pathValue}/`));
  const walk = (layers: Layer[], parents: string[], parentVisible: boolean) => {
    for (const layer of layers) {
      const current = [...parents, nameOf(layer)];
      const currentPath = current.join("/");
      const forcedVisible = matches(currentPath, visiblePrefixes);
      const hidden = matches(currentPath, hiddenPrefixes) && !forcedVisible;
      const visible = forcedVisible || (parentVisible && !layer.hidden && !hidden);
      if (layer.children) {
        if (visible || hasVisibleChild(currentPath)) walk(layer.children, current, visible);
      } else if (visible) draw(layer);
    }
  };
  walk(psd.children ?? [], [], true);
  await mkdir(outputDir, { recursive: true });
  const scale = Math.min(1, PSD_PREVIEW_MAX_DIMENSION / Math.max(psd.width, psd.height));
  if (scale < 1) {
    await sharp(Buffer.from(output), {
      raw: { width: psd.width, height: psd.height, channels: 4 },
    })
      .resize({
        width: Math.round(psd.width * scale),
        height: Math.round(psd.height * scale),
        fit: "fill",
        kernel: sharp.kernel.lanczos3,
      })
      .png({ compressionLevel: 6, adaptiveFiltering: true })
      .toFile(outputPath);
  } else {
    const png = new PNG({ width: psd.width, height: psd.height });
    png.data = Buffer.from(output);
    await writeFile(outputPath, PNG.sync.write(png));
  }
  return hash;
}
