import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = join(projectRoot, "compose.yml");
const backupScript = join(projectRoot, "scripts", "backup.mjs");
const composeUpScript = join(projectRoot, "scripts", "compose-up.mjs");
const applicationServices = ["app", "worker"];
const requiredFiles = ["diary-data.tar.gz", "postgres.dump"];

function showHelp() {
  console.log(`使い方:
  pnpm restore -- <backup-directory> --yes [オプション]
  pnpm restore -- <backup-directory> --verify-only

例:
  pnpm restore -- backup/20260811-171100 --verify-only
  pnpm restore -- backup/20260811-171100 --yes

オプション:
  --yes                   現在のメディアとDBを置き換えることを承認する
  --verify-only           復元せず、チェックサムとファイル形式だけを検証する
  --skip-safety-backup    復元直前の自動バックアップを省略する
  --keep-stopped          復元後にapp/workerを起動しない
  --help                  このヘルプを表示

既定では、復元前に現在の状態を通常のbackupディレクトリへ自動バックアップします。
.envは参照用としてバックアップに含まれますが、このスクリプトでは上書きしません。`);
}

function parseArguments(arguments_) {
  let backupDirectory = null;
  let confirmed = false;
  let verifyOnly = false;
  let createSafetyBackup = true;
  let startApplication = true;

  for (const argument of arguments_) {
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--yes") {
      confirmed = true;
      continue;
    }
    if (argument === "--verify-only") {
      verifyOnly = true;
      continue;
    }
    if (argument === "--skip-safety-backup") {
      createSafetyBackup = false;
      continue;
    }
    if (argument === "--keep-stopped") {
      startApplication = false;
      continue;
    }
    if (argument.startsWith("--")) throw new Error(`不明なオプションです: ${argument}`);
    if (backupDirectory !== null) throw new Error("バックアップディレクトリは1つだけ指定してください。");
    backupDirectory = isAbsolute(argument) ? argument : resolve(process.cwd(), argument);
  }

  if (backupDirectory === null) throw new Error("復元するバックアップディレクトリを指定してください。");
  if (!verifyOnly && !confirmed) {
    throw new Error("復元を実行するには、内容を確認したうえで --yes を指定してください。");
  }
  if (verifyOnly && !createSafetyBackup) {
    throw new Error("--verify-only と --skip-safety-backup は同時に指定できません。");
  }

  return { help: false, backupDirectory, verifyOnly, createSafetyBackup, startApplication };
}

function composeArguments(arguments_) {
  return ["compose", "-f", composeFile, ...arguments_];
}

function describeCommand(command, arguments_) {
  return `${command} ${arguments_.map((argument) => (argument.includes(" ") ? JSON.stringify(argument) : argument)).join(" ")}`;
}

function runCommand(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: projectRoot,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  if (result.error) throw new Error(`${command}を実行できませんでした: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${describeCommand(command, arguments_)} が終了コード ${result.status ?? "不明"} で失敗しました。`);
  }
  return result;
}

function runDocker(arguments_, options = {}) {
  return runCommand("docker", composeArguments(arguments_), options);
}

function captureDocker(arguments_) {
  const result = runDocker(arguments_, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return result.stdout.trim();
}

function sha256(filePath) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", rejectHash);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex").toUpperCase()));
  });
}

function readManifestChecksums(backupDirectory) {
  const manifestPath = join(backupDirectory, "BACKUP_MANIFEST.txt");
  if (!existsSync(manifestPath)) return null;
  const manifest = readFileSync(manifestPath, "utf8");
  const checksumFor = (fileName) =>
    manifest.match(new RegExp(`- ${fileName.replaceAll(".", "\\.")}:.*?\\r?\\n\\s+SHA256: ([A-Fa-f0-9]{64})`))?.[1];
  const checksums = Object.fromEntries(requiredFiles.map((fileName) => [fileName, checksumFor(fileName)]));
  if (Object.values(checksums).some((checksum) => checksum === undefined)) {
    throw new Error(`マニフェストのSHA-256記録が不完全です: ${manifestPath}`);
  }
  return checksums;
}

async function verifyBackup(backupDirectory) {
  if (!existsSync(backupDirectory) || !statSync(backupDirectory).isDirectory()) {
    throw new Error(`バックアップディレクトリが見つかりません: ${backupDirectory}`);
  }
  for (const fileName of requiredFiles) {
    const filePath = join(backupDirectory, fileName);
    if (!existsSync(filePath) || !statSync(filePath).isFile() || statSync(filePath).size === 0) {
      throw new Error(`必要なバックアップファイルが見つからないか空です: ${filePath}`);
    }
  }

  const recordedChecksums = readManifestChecksums(backupDirectory);
  if (recordedChecksums === null) {
    console.warn("BACKUP_MANIFEST.txtがないため、記録済みSHA-256との照合は省略します。");
  } else {
    console.log("SHA-256を検証しています。");
    for (const fileName of requiredFiles) {
      const actual = await sha256(join(backupDirectory, fileName));
      if (actual !== recordedChecksums[fileName].toUpperCase()) {
        throw new Error(`${fileName}のSHA-256がマニフェストと一致しません。`);
      }
    }
  }

  runDocker(["version"], { stdio: ["ignore", "ignore", "inherit"] });
  const readOnlyMount = `${backupDirectory}:/backup:ro`;
  console.log("メディアアーカイブを検証しています。");
  runDocker([
    "run",
    "--rm",
    "--no-deps",
    "-v",
    readOnlyMount,
    "app",
    "sh",
    "-c",
    "tar -tzf /backup/diary-data.tar.gz >/dev/null",
  ]);
  console.log("PostgreSQLダンプを検証しています。");
  runDocker(
    ["run", "--rm", "--no-deps", "-v", readOnlyMount, "postgres", "pg_restore", "--list", "/backup/postgres.dump"],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  console.log("バックアップの検証に成功しました。");
}

function getRunningApplicationServices() {
  const running = new Set(captureDocker(["ps", "--services", "--status", "running"]).split(/\r?\n/).filter(Boolean));
  return applicationServices.filter((service) => running.has(service));
}

function createSafetyBackup() {
  console.log("復元直前の安全バックアップを作成しています。");
  runCommand(process.execPath, [backupScript, "--keep-stopped"]);
}

function restoreMedia(backupDirectory) {
  const readOnlyMount = `${backupDirectory}:/backup:ro`;
  runDocker([
    "run",
    "--rm",
    "--no-deps",
    "-v",
    readOnlyMount,
    "app",
    "sh",
    "-c",
    "find /data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -C /data -xzf /backup/diary-data.tar.gz",
  ]);
}

function restoreDatabase(backupDirectory) {
  const readOnlyMount = `${backupDirectory}:/backup:ro`;
  runDocker([
    "run",
    "--rm",
    "--no-deps",
    "-v",
    readOnlyMount,
    "postgres",
    "pg_restore",
    "-h",
    "postgres",
    "-U",
    "diary",
    "-d",
    "diary",
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--single-transaction",
    "/backup/postgres.dump",
  ]);
}

async function restore(options) {
  if (!existsSync(composeFile)) throw new Error(`Composeファイルが見つかりません: ${composeFile}`);
  await verifyBackup(options.backupDirectory);
  if (options.verifyOnly) return;

  const previouslyRunning = getRunningApplicationServices();
  let replacementStarted = false;

  try {
    console.log("復元に必要なサービスを起動しています。");
    runDocker(["up", "-d", "postgres", "redis", "voicevox"]);

    if (options.createSafetyBackup) {
      createSafetyBackup();
    } else if (previouslyRunning.length > 0) {
      console.warn("安全バックアップを省略します。");
      runDocker(["stop", ...previouslyRunning]);
    }

    runDocker(["stop", ...applicationServices]);

    replacementStarted = true;
    console.log("メディアデータを復元しています。");
    restoreMedia(options.backupDirectory);
    console.log("PostgreSQLを単一トランザクションで復元しています。");
    restoreDatabase(options.backupDirectory);

    if (options.startApplication) {
      console.log("アプリケーションを起動しています。");
      runCommand(process.execPath, [composeUpScript, "-d"]);
    } else {
      console.log("--keep-stopped が指定されたため、app/workerは停止したままです。");
    }
    console.log(`リストアが完了しました: ${options.backupDirectory}`);
  } catch (error) {
    if (!replacementStarted && previouslyRunning.length > 0) {
      try {
        runDocker(["start", ...previouslyRunning]);
      } catch (restartError) {
        console.error(`元のサービス状態へ戻せませんでした: ${restartError}`);
      }
    }
    if (replacementStarted) {
      console.error("復元処理の途中で失敗したため、app/workerは安全のため停止したままです。");
    }
    throw error;
  }
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    showHelp();
  } else {
    await restore(options);
  }
} catch (error) {
  console.error(`リストアに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
