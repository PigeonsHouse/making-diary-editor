import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputArgs = process.argv.slice(2);
const forceCpu = inputArgs.includes("--cpu");
const forceGpu = inputArgs.includes("--gpu");

if (forceCpu && forceGpu) {
  console.error("--cpu と --gpu は同時に指定できません。");
  process.exit(1);
}

const forwardedArgs = inputArgs.filter((argument) => argument !== "--cpu" && argument !== "--gpu");
const envFile = resolve(projectRoot, ".env");
const envFileMode = existsSync(envFile)
  ? readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .find((line) => /^\s*RENDER_GPU_MODE\s*=/.test(line))
      ?.replace(/^\s*RENDER_GPU_MODE\s*=\s*/, "")
      .replace(/^['"]|['"]$/g, "")
      .trim()
  : undefined;
const hostHasNvidiaGpu =
  spawnSync("nvidia-smi", ["-L"], { stdio: "ignore", timeout: 5_000, windowsHide: true }).status === 0;
const requestedMode = process.env.RENDER_GPU_MODE ?? envFileMode;
const configuredMode = requestedMode === "off" || requestedMode === "required" ? requestedMode : "auto";
const useGpu = forceGpu || (!forceCpu && configuredMode !== "off" && hostHasNvidiaGpu);

if (!forceCpu && (forceGpu || configuredMode === "required") && !hostHasNvidiaGpu) {
  console.error("NVIDIA GPUを検出できませんでした。CPUで起動する場合は --cpu を指定してください。");
  process.exit(1);
}

const composeArgs = ["compose", "-f", resolve(projectRoot, "compose.yml")];
if (useGpu) composeArgs.push("-f", resolve(projectRoot, "compose.gpu.yml"));
composeArgs.push("up", ...forwardedArgs);

console.log(useGpu ? "NVIDIA GPUを検出したためGPU構成で起動します。" : "CPU互換構成で起動します。");
const result = spawnSync("docker", composeArgs, {
  cwd: projectRoot,
  env: {
    ...process.env,
    RENDER_GPU_MODE: forceCpu ? "off" : forceGpu ? "required" : configuredMode,
  },
  stdio: "inherit",
  windowsHide: false,
});

if (result.error) {
  console.error(`Docker Composeを起動できませんでした: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
