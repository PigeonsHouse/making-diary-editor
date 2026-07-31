import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {readPsd, type Layer} from "ag-psd";
import {PNG} from "pngjs";

export type PsdGroup = {path: string; name: string; choices: Array<{path: string; name: string}>};

const nameOf = (layer: Layer) => (layer.name ?? "名称なし").replace(/^[/!\*]+/, "");

export async function readPsdGroups(filePath: string): Promise<PsdGroup[]> {
  const psd = readPsd(await readFile(filePath), {
    skipLayerImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
    skipLinkedFilesData: true,
  });
  const groups: PsdGroup[] = [];
  const walk = (layers: Layer[], parents: string[]) => {
    for (const layer of layers) {
      if (!layer.children) continue;
      const current = [...parents, nameOf(layer)];
      const choices = layer.children.filter((child) => !child.children).map((child) => ({
        path: [...current, nameOf(child)].join("/"), name: nameOf(child),
      }));
      if (choices.length > 1) groups.push({path: current.join("/"), name: nameOf(layer), choices});
      walk(layer.children, current);
    }
  };
  walk(psd.children ?? [], []);
  return groups;
}

export async function renderPsdPreview(filePath: string, selections: Record<string, string>, outputDir: string) {
  const source = await readFile(filePath);
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
    const opacity = layer.opacity ?? 1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const dx = left + x; const dy = top + y;
      if (dx < 0 || dy < 0 || dx >= psd.width || dy >= psd.height) continue;
      const si = (y * width + x) * 4; const di = (dy * psd.width + dx) * 4;
      const sa = (data[si + 3] / 255) * opacity; const da = output[di + 3] / 255;
      const oa = sa + da * (1 - sa); if (oa === 0) continue;
      for (let c = 0; c < 3; c++) output[di + c] = Math.round((data[si + c] * sa + output[di + c] * da * (1 - sa)) / oa);
      output[di + 3] = Math.round(oa * 255);
    }
  };
  const walk = (layers: Layer[], parents: string[], enabled: boolean) => {
    for (const layer of layers) {
      const current = [...parents, nameOf(layer)];
      const currentPath = current.join("/");
      const selected = selections[parents.join("/")];
      const visible = enabled && (selected ? selected === currentPath : !layer.hidden);
      if (layer.children) walk(layer.children, current, visible || enabled);
      else if (visible) draw(layer);
    }
  };
  walk(psd.children ?? [], [], true);
  const hash = createHash("sha256").update(source).update(JSON.stringify(selections)).digest("hex");
  await mkdir(outputDir, {recursive: true});
  const png = new PNG({width: psd.width, height: psd.height});
  png.data = Buffer.from(output);
  await writeFile(path.join(outputDir, `${hash}.png`), PNG.sync.write(png));
  return hash;
}
