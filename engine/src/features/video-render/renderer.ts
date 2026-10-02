import { mkdir, stat, writeFile } from "node:fs/promises";
import { crc32, deflateSync } from "node:zlib";
import { join } from "node:path";
import { buildAss, luminance, type TextCue } from "./captions";
import { probeDuration, run } from "./ffmpeg";
import type { TtsService } from "./tts/tts.service";
import { aspectSize, estimateSceneSeconds, MUSIC_TRACKS, type Scene, type VideoSpec } from "./video-spec";
import type { VideoOptions } from "./video.config";

const FPS = 30;
const VOICE_LEAD = 0.25; // seconds after a scene starts before its voiceover begins
const LOUDNESS_I = -14; // LUFS, the TikTok / Reels / Zalo norm
const LOUDNESS_TP = -1.5;

/** A problem with the request itself (too long, unreadable asset): retrying will not help. */
export class RenderRejected extends Error {}

export type Stage = "tts" | "scenes" | "mix" | "encode" | "poster";

export type RenderInput = {
  readonly spec: VideoSpec;
  readonly workDir: string;
  /** bucket path ("<ws>/file") -> local file, for every asset the spec names. */
  readonly assets: ReadonlyMap<string, string>;
  readonly signal: AbortSignal;
  readonly options: VideoOptions;
  readonly tts: TtsService;
  readonly onProgress: (stage: Stage, percent: number) => void;
};

export type RenderOutput = {
  readonly videoFile: string;
  readonly posterFile: string;
  readonly durationMs: number;
  readonly sizeBytes: number;
  readonly width: number;
  readonly height: number;
  readonly meta: Record<string, unknown>;
};

const XFADE: Record<Exclude<Scene["transition"], "none">, { readonly name: string; readonly seconds: number }> = {
  fade: { name: "fade", seconds: 0.5 },
  slide: { name: "slideleft", seconds: 0.45 },
  wipe: { name: "wipeleft", seconds: 0.45 },
  zoom: { name: "zoomin", seconds: 0.5 },
};

const hex0x = (c: string): string => `0x${c.slice(1)}`;
const f3 = (n: number): string => n.toFixed(3);

/**
 * The whole render. Pipeline (every ffmpeg call is bounded: nice 10, 4 threads, killed on abort):
 *   1. voiceover per scene (TTS, cached) -> real clip lengths decide the scene lengths
 *   2. one intermediate clip per scene (image with Ken Burns, trimmed video, colour or gradient card)
 *   3. audio: voices placed on a timeline, music ducked under them (sidechain), two-pass loudness normalisation to -14 LUFS
 *   4. final pass: crossfades, brand logo, burned-in captions (libass), x264 + the prepared AAC, then a poster frame
 */
export const renderVideo = async (input: RenderInput): Promise<RenderOutput> => {
  const { spec, workDir, signal, options } = input;
  const { width: W, height: H } = aspectSize(spec.aspect);
  const timings: Record<string, number> = {};
  const warnings: string[] = [];
  let peakRssKb = 0;
  const peaks: Record<string, number> = {};
  let step = "";
  const note = (r: { peakRssKb: number }) => {
    if (r.peakRssKb > peakRssKb) peakRssKb = r.peakRssKb;
    peaks[step] = Math.max(peaks[step] ?? 0, Math.round(r.peakRssKb / 1024));
  };
  const lap = (name: string, since: number) => { timings[name] = Date.now() - since; };
  await mkdir(workDir, { recursive: true });

  /* ---- 1. voiceover ---------------------------------------------------------------- */
  let t0 = Date.now();
  const voice: Array<{ file: string; seconds: number } | null> = spec.scenes.map(() => null);
  const wanted = spec.scenes.filter((s) => s.voiceover !== "").length;
  let ttsCached = 0;
  let ttsFailed = 0;
  if (wanted > 0 && spec.voice.enabled) {
    if (!input.tts.enabled) {
      warnings.push("tts_disabled");
    } else {
      let done = 0;
      for (let i = 0; i < spec.scenes.length; i++) {
        const text = spec.scenes[i].voiceover;
        if (!text) continue;
        try {
          const clip = await input.tts.clip(text, spec.voice.name, spec.voice.rate_pct, signal);
          if (clip.cached) ttsCached++;
          voice[i] = { file: clip.file, seconds: await probeDuration(clip.file, signal) };
        } catch (e) {
          if (signal.aborted) throw e;
          ttsFailed++;
          warnings.push(`tts_failed_scene_${i + 1}`);
        }
        input.onProgress("tts", Math.round((++done / wanted) * 100));
      }
    }
  }
  if (wanted > 0 && !voice.some((v) => v)) warnings.push("captions_only");
  lap("tts_ms", t0);

  /* ---- 2. scene lengths --------------------------------------------------------------- */
  const hasVoice = (i: number) => voice[i] !== null;
  const lengths = spec.scenes.map((s, i) => {
    const v = voice[i];
    if (s.duration_s > 0) return Math.max(s.duration_s, v ? v.seconds + VOICE_LEAD + 0.4 : 0);
    if (v) return Math.max(2.5, v.seconds + VOICE_LEAD + 0.7);
    return estimateSceneSeconds(s);
  });
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total > options.maxSeconds + 0.5) throw new RenderRejected(`video_too_long: ${Math.round(total)} s (max ${options.maxSeconds} s)`);
  const starts: number[] = [];
  lengths.reduce((acc, l, i) => { starts[i] = acc; return acc + l; }, 0);
  const trans = spec.scenes.map((s, i) => (i === spec.scenes.length - 1 ? { name: "fade", seconds: 0 } : s.transition === "none" ? { name: "fade", seconds: 0.04 } : XFADE[s.transition]));

  /* ---- 3. one intermediate clip per scene ------------------------------------------------ */
  t0 = Date.now();
  step = "scenes";
  const segFiles: string[] = [];
  for (let i = 0; i < spec.scenes.length; i++) {
    const s = spec.scenes[i];
    const len = lengths[i] + trans[i].seconds;
    const file = join(workDir, `seg${i}.mp4`);
    let gradFile: string | undefined;
    if (s.background.type === "gradient") {
      gradFile = join(workDir, `grad${i}.png`);
      await writeGradientPng(gradFile, s.background.from, s.background.to, i % 2 === 0 ? "vertical" : "diagonal");
    }
    await run("ffmpeg", sceneArgs(s, i, len, W, H, input.assets, file, options.ffmpegThreads, gradFile), { signal, cwd: workDir }).then(note);
    segFiles.push(file);
    input.onProgress("scenes", Math.round(((i + 1) / spec.scenes.length) * 100));
  }
  lap("scenes_ms", t0);

  /* ---- 4. audio ------------------------------------------------------------------------- */
  t0 = Date.now();
  step = "audio";
  const audioFile = join(workDir, "audio.m4a");
  const loudness = await buildAudio({ spec, voice, starts, total, workDir, audioFile, signal, options, assets: input.assets, note });
  lap("audio_ms", t0);
  input.onProgress("mix", 100);

  /* ---- 5. captions file ------------------------------------------------------------------ */
  const cues: TextCue[] = spec.brand.name ? [{ start: 0, end: total, text: spec.brand.name, kind: "brand" }] : [];
  spec.scenes.forEach((s, i) => {
    const start = starts[i];
    const end = starts[i] + lengths[i];
    const bg = s.background;
    const light = bg.type === "color" ? luminance(bg.color) > 0.55 : bg.type === "gradient" ? (luminance(bg.from) + luminance(bg.to)) / 2 > 0.55 : false;
    if (s.text) cues.push({ start: start + 0.15, end, text: s.text, kind: "headline", light });
    // Captions only mode: when the voice failed, the spoken text is shown instead of an empty caption.
    const caption = s.caption || (s.voiceover && !hasVoice(i) ? s.voiceover : "");
    if (spec.captions && caption) cues.push({ start: start + 0.2, end: Math.max(start + 0.8, end - 0.1), text: caption, kind: "caption" });
  });
  await writeFile(join(workDir, "subs.ass"), buildAss(spec.aspect, cues), "utf8");

  /* ---- 6. final pass ---------------------------------------------------------------------- */
  t0 = Date.now();
  step = "encode";
  const out = join(workDir, "out.mp4");
  const logo = spec.brand.logo ? input.assets.get(spec.brand.logo) : undefined;
  const args: string[] = [];
  segFiles.forEach((f) => args.push("-threads", "1", "-i", f)); // one decoder thread per intermediate: frame-threaded decoders of 4+ inputs were the memory peak
  const audioIdx = segFiles.length;
  args.push("-i", audioFile);
  const logoIdx = logo ? audioIdx + 1 : -1;
  if (logo) args.push("-loop", "1", "-framerate", String(FPS), "-i", logo);
  const g: string[] = [];
  let last = "0:v";
  for (let i = 1; i < segFiles.length; i++) {
    const t = trans[i - 1];
    const offset = starts[i];
    g.push(`[${last}][${i}:v]xfade=transition=${t.name}:duration=${f3(t.seconds)}:offset=${f3(offset)}[x${i}]`);
    last = `x${i}`;
  }
  if (logoIdx >= 0) {
    const lw = Math.round(Math.min(W, H) * 0.17);
    const m = Math.round(Math.min(W, H) * 0.045);
    g.push(`[${logoIdx}:v]scale=${lw}:-1:force_original_aspect_ratio=decrease,format=rgba[lg]`);
    g.push(`[${last}][lg]overlay=${m}:${Math.round(H * (spec.aspect === "9:16" ? 0.05 : 0.035))}:shortest=1[lo]`);
    last = "lo";
  }
  g.push(`[${last}]ass=subs.ass:fontsdir=${join(options.assetsDir, "fonts")},format=yuv420p[v]`);
  args.push(
    "-filter_complex", g.join(";"),
    "-map", "[v]", "-map", `${audioIdx}:a`,
    "-t", f3(total),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-maxrate", "3500k", "-bufsize", "7000k", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "copy", "-movflags", "+faststart", "-threads", String(options.ffmpegThreads), "-filter_threads", "2", "-filter_complex_threads", "2",
    out,
  );
  const encode = await run("ffmpeg", args, { signal, cwd: workDir, onTime: (sec) => input.onProgress("encode", Math.min(99, Math.round((sec / total) * 100))) });
  note(encode);
  lap("encode_ms", t0);

  /* ---- 7. poster ---------------------------------------------------------------------------- */
  step = "poster";
  const poster = join(workDir, "poster.jpg");
  const posterAt = Math.min(total - 0.1, starts[0] + Math.min(1.4, lengths[0] * 0.6));
  note(await run("ffmpeg", ["-ss", f3(posterAt), "-i", out, "-frames:v", "1", "-vf", `scale=${Math.min(W, 720)}:-2`, "-q:v", "3", poster], { signal, cwd: workDir }));
  input.onProgress("poster", 100);

  const size = (await stat(out)).size;
  const realDuration = await probeDuration(out, signal);
  return {
    videoFile: out,
    posterFile: poster,
    durationMs: Math.round(realDuration * 1000),
    sizeBytes: size,
    width: W,
    height: H,
    meta: {
      width: W,
      height: H,
      fps: FPS,
      scenes: spec.scenes.length,
      warnings,
      tts: { provider: input.tts.providerId, requested: wanted, failed: ttsFailed, cached: ttsCached },
      voiceover: wanted === 0 ? "none" : voice.some((v) => v) ? "tts" : "captions_only",
      music: spec.music?.track ?? null,
      loudness,
      timings,
      memory: { ffmpeg_peak_rss_mb: Math.round(peakRssKb / 1024), ffmpeg_peak_by_step_mb: peaks, node_rss_mb: Math.round(process.memoryUsage().rss / 1048576) },
    },
  };
};

/* ------------------------------------------------------------------------------------------ */

/** A 96x96 RGB PNG holding a two-colour gradient (top to bottom, or corner to corner). Scaled to the frame by ffmpeg. */
const writeGradientPng = async (file: string, from: string, to: string, dir: "vertical" | "diagonal"): Promise<void> => {
  const n = 96;
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [c(from), c(to)];
  const raw = Buffer.alloc((n * 3 + 1) * n);
  for (let y = 0; y < n; y++) {
    raw[y * (n * 3 + 1)] = 0;
    for (let x = 0; x < n; x++) {
      const t = dir === "vertical" ? y / (n - 1) : (x + y) / (2 * (n - 1));
      for (let k = 0; k < 3; k++) raw[y * (n * 3 + 1) + 1 + x * 3 + k] = Math.round(a[k] + (b[k] - a[k]) * t);
    }
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  await writeFile(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
};

const sceneArgs = (s: Scene, _idx: number, len: number, W: number, H: number, assets: ReadonlyMap<string, string>, out: string, threads: number, gradFile?: string): string[] => {
  const enc = ["-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), "-g", String(FPS), "-threads", String(threads), "-t", f3(len), out];
  const bg = s.background;
  const local = (p: string): string => {
    const f = assets.get(p);
    if (!f) throw new RenderRejected(`asset_missing: ${p}`);
    return f;
  };
  if (bg.type === "color") return ["-f", "lavfi", "-i", `color=c=${hex0x(bg.color)}:s=${W}x${H}:r=${FPS}:d=${f3(len)}`, ...enc];
  if (bg.type === "gradient") {
    // The gradient is a small PNG (see writeGradientPng) scaled up smoothly: the lavfi gradients source ignores its line for some sizes.
    return ["-loop", "1", "-framerate", String(FPS), "-i", gradFile ?? "", "-vf", `scale=${W}:${H}:flags=bicubic,setsar=1,format=yuv420p`, ...enc];
  }
  if (bg.type === "video") {
    const vf = `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,format=yuv420p`;
    return ["-ss", f3(bg.start_s), "-stream_loop", "-1", "-i", local(bg.src), "-vf", vf, ...enc];
  }
  // image: Ken Burns. The source is scaled to 1.5x the frame so zoompan's whole-pixel crops do not jitter.
  const SW = Math.round((W * 1.5) / 2) * 2;
  const SH = Math.round((H * 1.5) / 2) * 2;
  const n = Math.max(2, Math.round(len * FPS));
  const centre = "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'";
  const motion: Record<typeof bg.motion, string> = {
    "zoom-in": `z='1+0.14*on/${n}':${centre}`,
    "zoom-out": `z='1.14-0.14*on/${n}':${centre}`,
    "pan-left": `z=1.15:x='(iw-iw/zoom)*(1-on/${n})':y='ih/2-(ih/zoom/2)'`,
    "pan-right": `z=1.15:x='(iw-iw/zoom)*on/${n}':y='ih/2-(ih/zoom/2)'`,
    none: `z=1:${centre}`,
  };
  const vf = `scale=${SW}:${SH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${SW}:${SH},setsar=1,zoompan=${motion[bg.motion]}:d=${n}:s=${W}x${H}:fps=${FPS},format=yuv420p`;
  return ["-i", local(bg.src), "-vf", vf, ...enc];
};

type AudioArgs = {
  readonly spec: VideoSpec;
  readonly voice: ReadonlyArray<{ file: string; seconds: number } | null>;
  readonly starts: ReadonlyArray<number>;
  readonly total: number;
  readonly workDir: string;
  readonly audioFile: string;
  readonly signal: AbortSignal;
  readonly options: VideoOptions;
  readonly assets: ReadonlyMap<string, string>;
  readonly note: (r: { peakRssKb: number }) => void;
};

/** Voices on a timeline + music ducked under them + two-pass loudnorm. Returns the measured/applied loudness. */
const buildAudio = async (a: AudioArgs): Promise<Record<string, unknown>> => {
  const { spec, total, workDir, signal } = a;
  const voices = a.voice.map((v, i) => ({ v, i })).filter((x): x is { v: { file: string; seconds: number }; i: number } => x.v !== null);
  const track = spec.music ? MUSIC_TRACKS.find((t) => t.id === spec.music!.track) : undefined;
  const musicFile = track ? join(a.options.assetsDir, "music", `${track.id}.mp3`) : null;
  if (musicFile) {
    try {
      await stat(musicFile);
    } catch {
      throw new RenderRejected(`music_missing: ${track!.id}`);
    }
  }
  const fmt = "aformat=sample_rates=44100:channel_layouts=stereo";
  const args: string[] = [];
  voices.forEach(({ v }) => args.push("-i", v.file));
  if (musicFile) args.push("-stream_loop", "-1", "-i", musicFile);
  const g: string[] = [];
  const hasV = voices.length > 0;
  if (hasV) {
    voices.forEach(({ i }, k) => {
      const ms = Math.round((a.starts[i] + VOICE_LEAD) * 1000);
      g.push(`[${k}:a]${fmt},adelay=${ms}|${ms}[v${k}]`);
    });
    g.push(`${voices.map((_, k) => `[v${k}]`).join("")}amix=inputs=${voices.length}:normalize=0:dropout_transition=0,apad=whole_dur=${f3(total)},atrim=0:${f3(total)}[voice]`);
  }
  if (musicFile) {
    const m = voices.length;
    const vol = (spec.music!.volume * (hasV ? 0.55 : 0.9)).toFixed(3);
    g.push(`[${m}:a]${fmt},atrim=0:${f3(total)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=1,afade=t=out:st=${f3(Math.max(0, total - 2))}:d=2,volume=${vol}[music]`);
  }
  let mix: string;
  if (hasV && musicFile) {
    g.push("[voice]asplit=2[vm][vk]");
    g.push("[music][vk]sidechaincompress=threshold=0.02:ratio=12:attack=10:release=450:makeup=1[duck]");
    g.push("[vm][duck]amix=inputs=2:normalize=0:duration=first[mix]");
    mix = "mix";
  } else if (hasV) mix = "voice";
  else if (musicFile) mix = "music";
  else {
    // No voice, no music: a silent stereo track (some platforms reject a video without audio).
    args.push("-f", "lavfi", "-i", `anullsrc=r=44100:cl=stereo`);
    g.push(`[0:a]atrim=0:${f3(total)}[silent]`);
    mix = "silent";
  }
  const premix = join(workDir, "premix.wav");
  a.note(await run("ffmpeg", [...args, "-filter_complex", g.join(";"), "-map", `[${mix}]`, "-t", f3(total), "-c:a", "pcm_s16le", "-ar", "44100", premix], { signal, cwd: workDir }));

  // Pass 1: measure. Pass 2: apply with the measured values (linear, exact -14 LUFS). A silent mix is only encoded.
  const target = `I=${LOUDNESS_I}:TP=${LOUDNESS_TP}:LRA=11`;
  let af = "aresample=44100";
  let measured: Record<string, unknown> = {};
  if (hasV || musicFile) {
    const pass1 = await run("ffmpeg", ["-i", premix, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], { signal, cwd: workDir });
    a.note(pass1);
    const m = pass1.stderr.match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
    if (m) {
      try {
        measured = JSON.parse(m[0]) as Record<string, unknown>;
        const ok = ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"].every((k) => Number.isFinite(Number(measured[k])));
        if (ok && Number(measured.input_i) > -70) {
          af = `loudnorm=${target}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true,aresample=44100`;
        }
      } catch {
        /* fall through to a plain encode */
      }
    }
  }
  a.note(await run("ffmpeg", ["-i", premix, "-af", af, "-c:a", "aac", "-b:a", "160k", "-ar", "44100", a.audioFile], { signal, cwd: workDir }));
  return { target_lufs: LOUDNESS_I, measured_lufs: measured.input_i !== undefined ? Number(measured.input_i) : null, measured_tp: measured.input_tp !== undefined ? Number(measured.input_tp) : null, normalised: af.startsWith("loudnorm") };
};
