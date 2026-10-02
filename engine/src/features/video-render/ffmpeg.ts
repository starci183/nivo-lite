import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

export type RunResult = { readonly peakRssKb: number; readonly ms: number; readonly stderr: string };

export class FfmpegError extends Error {
  constructor(message: string, readonly stderr: string) {
    super(message);
  }
}

const isLinux = process.platform === "linux";

/** Peak resident memory (VmHWM) of one process, from /proc. 0 where /proc does not exist. */
const rssOf = async (pid: number | undefined): Promise<number> => {
  if (!pid || !isLinux) return 0;
  try {
    const status = await readFile(`/proc/${pid}/status`, "utf8");
    const m = status.match(/VmHWM:\s+(\d+)\s+kB/);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
};

export type RunOptions = {
  readonly signal: AbortSignal;
  readonly cwd: string;
  /** Output position in seconds, parsed from ffmpeg -progress (only for commands that write a timeline). */
  readonly onTime?: (seconds: number) => void;
  /** Lower the CPU priority so a render never starves the other job kinds sharing the host. */
  readonly nice?: boolean;
  readonly timeoutMs?: number;
};

/** Run ffmpeg or ffprobe without a shell. Rejects with the stderr tail when the exit code is not 0. Kills the child on abort or timeout. */
export const run = (bin: "ffmpeg" | "ffprobe", args: ReadonlyArray<string>, o: RunOptions): Promise<RunResult> =>
  new Promise<RunResult>((resolve, reject) => {
    const started = Date.now();
    const full = bin === "ffmpeg" ? ["-hide_banner", "-nostdin", "-y", ...(o.onTime ? ["-progress", "pipe:1", "-nostats"] : []), ...args] : [...args];
    const useNice = o.nice !== false && isLinux;
    const child = useNice ? spawn("nice", ["-n", "10", bin, ...full], { cwd: o.cwd }) : spawn(bin, full, { cwd: o.cwd });
    let stderr = "";
    let stdout = "";
    let peak = 0;
    let settled = false;
    const poll = setInterval(() => void rssOf(child.pid).then((kb) => { if (kb > peak) peak = kb; }), 400);
    const kill = () => { if (!child.killed) child.kill("SIGKILL"); };
    const onAbort = () => { kill(); fail(new Error("aborted")); };
    const timer = setTimeout(() => { kill(); fail(new FfmpegError(`${bin} timed out`, stderr.slice(-1500))); }, o.timeoutMs ?? 20 * 60_000);
    o.signal.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => { clearInterval(poll); clearTimeout(timer); o.signal.removeEventListener("abort", onAbort); };
    const fail = (e: Error) => { if (settled) return; settled = true; cleanup(); reject(e); };
    child.stdout.on("data", (d: Buffer) => {
      const text = d.toString();
      if (!o.onTime) { stdout += text; return; }
      for (const m of text.matchAll(/out_time_us=(\d+)/g)) o.onTime(Number(m[1]) / 1e6);
    });
    child.stderr.on("data", (d: Buffer) => { stderr = (stderr + d.toString()).slice(-60_000); });
    child.on("error", (e) => fail(new FfmpegError(`${bin} could not start: ${e.message}`, "")));
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (code === 0) resolve({ peakRssKb: peak, ms: Date.now() - started, stderr: bin === "ffprobe" ? stdout : stderr });
      else reject(new FfmpegError(`${bin} exited with ${code}`, stderr.slice(-1500)));
    });
  });

/** Duration of a media file in seconds. */
export const probeDuration = async (file: string, signal: AbortSignal): Promise<number> => {
  const r = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { signal, cwd: ".", nice: false, timeoutMs: 30_000 });
  const n = Number(r.stderr.trim());
  if (!Number.isFinite(n) || n <= 0) throw new FfmpegError(`ffprobe could not read the duration of ${file}`, "");
  return n;
};
