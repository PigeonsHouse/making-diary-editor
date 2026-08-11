import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = join(projectRoot, "compose.yml");
const environmentFile = join(projectRoot, ".env");
const applicationServices = ["app", "worker"];

function showHelp() {
  console.log(`使い方: pnpm backup -- [オプション]

オプション:
  --output-dir <path>  バックアップの保存先（既定: ./backup）
  --keep-stopped       バックアップ前に動いていたapp/workerを再開しない
  --help               このヘルプを表示

出力例: backup/20260811-143000/`);
}

function parseArguments(arguments_) {
  let outputDirectory = join(projectRoot, "backup");
  let restartServices = true;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--keep-stopped") {
      restartServices = false;
      continue;
    }
    if (argument === "--output-dir") {
      const value = arguments_[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--output-dir には保存先を指定してください。");
      outputDirectory = isAbsolute(value) ? value : resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    throw new Error(`不明なオプションです: ${argument}`);
  }

  return { help: false, outputDirectory, restartServices };
}

function timestamp(date = new Date()) {
  const number = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${number(date.getMonth() + 1)}${number(date.getDate())}-${number(date.getHours())}${number(
    date.getMinutes(),
  )}${number(date.getSeconds())}`;
}

function displayDate(date) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  return `${formatted} ${timeZone}`;
}

function composeArguments(arguments_) {
  return ["compose", "-f", composeFile, ...arguments_];
}

function describeCommand(arguments_) {
  return `docker ${arguments_.map((argument) => (argument.includes(" ") ? JSON.stringify(argument) : argument)).join(" ")}`;
}

function runDocker(arguments_, options = {}) {
  const result = spawnSync("docker", composeArguments(arguments_), {
    cwd: projectRoot,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  if (result.error) throw new Error(`Dockerを実行できませんでした: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(
      `${describeCommand(composeArguments(arguments_))} が終了コード ${result.status ?? "不明"} で失敗しました。`,
    );
  }
  return result;
}

function captureDocker(arguments_) {
  const result = spawnSync("docker", composeArguments(arguments_), {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    windowsHide: true,
  });
  if (result.error) throw new Error(`Dockerを実行できませんでした: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(
      `${describeCommand(composeArguments(arguments_))} が終了コード ${result.status ?? "不明"} で失敗しました。`,
    );
  }
  return result.stdout.trim();
}

function dumpDatabase(outputPath) {
  const descriptor = openSync(outputPath, "wx", 0o600);
  try {
    runDocker(["exec", "-T", "postgres", "pg_dump", "-U", "diary", "-d", "diary", "-Fc"], {
      stdio: ["ignore", descriptor, "inherit"],
    });
  } finally {
    closeSync(descriptor);
  }
}

function validateDatabaseDump(inputPath) {
  const descriptor = openSync(inputPath, "r");
  try {
    runDocker(["exec", "-T", "postgres", "pg_restore", "--list"], {
      stdio: [descriptor, "ignore", "inherit"],
    });
  } finally {
    closeSync(descriptor);
  }
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

function getRowCounts() {
  const output = captureDocker([
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "diary",
    "-d",
    "diary",
    "-At",
    "-c",
    "SELECT 'assets=' || count(*) FROM assets UNION ALL SELECT 'projects=' || count(*) FROM projects;",
  ]);
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.trim().split("="))
      .filter((parts) => parts.length === 2),
  );
}

async function createBackup({ outputDirectory, restartServices }) {
  if (!existsSync(composeFile)) throw new Error(`Composeファイルが見つかりません: ${composeFile}`);
  if (!existsSync(environmentFile)) throw new Error(`バックアップ対象の.envが見つかりません: ${environmentFile}`);

  runDocker(["version"], { stdio: ["ignore", "ignore", "inherit"] });

  const startedAt = new Date();
  const backupName = timestamp(startedAt);
  const incompleteDirectory = join(outputDirectory, `${backupName}.incomplete`);
  const completedDirectory = join(outputDirectory, backupName);
  if (existsSync(incompleteDirectory) || existsSync(completedDirectory)) {
    throw new Error(`同名のバックアップが既に存在します: ${backupName}`);
  }

  mkdirSync(outputDirectory, { recursive: true });
  mkdirSync(incompleteDirectory, { mode: 0o700 });

  const runningServices = new Set(
    captureDocker(["ps", "--services", "--status", "running"]).split(/\r?\n/).filter(Boolean),
  );
  const servicesToRestart = applicationServices.filter((service) => runningServices.has(service));
  let backupCompleted = false;

  try {
    if (servicesToRestart.length > 0) {
      console.log(`アプリケーションを停止しています: ${servicesToRestart.join(", ")}`);
      runDocker(["stop", ...servicesToRestart]);
    } else {
      console.log("app/workerは停止済みです。");
    }

    const archivePath = join(incompleteDirectory, "diary-data.tar.gz");
    const databasePath = join(incompleteDirectory, "postgres.dump");
    const copiedEnvironmentPath = join(incompleteDirectory, ".env");
    const bindMount = `${incompleteDirectory}:/backup`;

    console.log("メディアデータをアーカイブしています。");
    runDocker([
      "run",
      "--rm",
      "--no-deps",
      "-v",
      bindMount,
      "app",
      "sh",
      "-c",
      "tar -C /data -czf /backup/diary-data.tar.gz .",
    ]);

    console.log("PostgreSQLをダンプしています。");
    dumpDatabase(databasePath);

    copyFileSync(environmentFile, copiedEnvironmentPath);
    chmodSync(copiedEnvironmentPath, 0o600);

    console.log("バックアップを検証しています。");
    runDocker([
      "run",
      "--rm",
      "--no-deps",
      "-v",
      `${incompleteDirectory}:/backup:ro`,
      "app",
      "sh",
      "-c",
      "tar -tzf /backup/diary-data.tar.gz >/dev/null",
    ]);
    validateDatabaseDump(databasePath);
    const rowCounts = getRowCounts();
    const [archiveHash, databaseHash] = await Promise.all([sha256(archivePath), sha256(databasePath)]);

    const archiveSize = statSync(archivePath).size;
    const databaseSize = statSync(databasePath).size;
    const sourceDescription = `${process.platform} host, making-diary-editor Docker Compose environment`;
    const manifest = `Backup created: ${displayDate(startedAt)}
Format version: 2
Source: ${sourceDescription}

Files:
- diary-data.tar.gz: ${archiveSize} bytes
  SHA256: ${archiveHash}
- postgres.dump: ${databaseSize} bytes
  SHA256: ${databaseHash}
- .env: copied without displaying its contents

Validation:
- diary-data.tar.gz was listed successfully inside the app image.
- postgres.dump was listed successfully with pg_restore.
- Database row counts at backup: assets=${rowCounts.assets ?? "unknown"}, projects=${rowCounts.projects ?? "unknown"}.

Service state:
- Running before backup: ${servicesToRestart.length > 0 ? servicesToRestart.join(", ") : "none of app/worker"}
- Restart requested: ${restartServices ? "yes" : "no (--keep-stopped)"}
`;
    writeFileSync(join(incompleteDirectory, "BACKUP_MANIFEST.txt"), manifest, { encoding: "utf8", mode: 0o600 });

    renameSync(incompleteDirectory, completedDirectory);
    backupCompleted = true;
    console.log(`バックアップを作成しました: ${relative(projectRoot, completedDirectory) || completedDirectory}`);
    return completedDirectory;
  } finally {
    if (restartServices && servicesToRestart.length > 0) {
      console.log(`停止前に動作していたサービスを再開しています: ${servicesToRestart.join(", ")}`);
      try {
        runDocker(["start", ...servicesToRestart]);
      } catch (error) {
        const location = backupCompleted ? completedDirectory : incompleteDirectory;
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}\nバックアップ${backupCompleted ? "" : "途中のデータ"}は ${location} にあります。`,
        );
      }
    }
  }
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    showHelp();
  } else {
    await createBackup(options);
  }
} catch (error) {
  console.error(`バックアップに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
