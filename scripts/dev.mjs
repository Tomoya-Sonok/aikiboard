import { spawn } from "node:child_process";
import { mkdirSync, openSync, closeSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const isBackground = args.includes("--bg");

const commands = [
  { name: "frontend", args: ["--filter", "aikiboard-frontend", "dev"] },
  { name: "backend", args: ["--filter", "aikiboard-backend", "dev"] },
];

const runForeground = () => {
  return commands.map(({ name, args: cmdArgs }) => {
    const child = spawn("pnpm", cmdArgs, {
      stdio: "inherit",
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        console.log(`[${name}] stopped by signal ${signal}`);
        return;
      }
      console.log(`[${name}] exited with code ${code}`);
    });
    return child;
  });
};

const runBackground = () => {
  const logDir = resolve(process.cwd(), "logs");
  mkdirSync(logDir, { recursive: true });

  return commands.map(({ name, args: cmdArgs }) => {
    const logPath = resolve(logDir, `dev-${name}.log`);
    const outFd = openSync(logPath, "a");
    const errFd = openSync(logPath, "a");

    const child = spawn("pnpm", cmdArgs, {
      detached: true,
      stdio: ["ignore", outFd, errFd],
    });
    child.unref();
    closeSync(outFd);
    closeSync(errFd);
    console.log(`[${name}] started in background -> ${logPath}`);
    return child;
  });
};

if (isBackground) {
  runBackground();
} else {
  runForeground();
}
