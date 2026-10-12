/**
 * The video render spec: ONE JSON document describes a whole short video. Pure module (no imports): the app uses it to validate before enqueueing,
 * and engine/src/features/video-render/video-spec.ts is a VERBATIM COPY the engine validates again (the engine never trusts the queue).
 * `npm run video:spec-sync` (scripts/video-spec-sync.mjs) fails when the two copies differ. Edit here, then copy.
 *
 * Contract summary
 *   - 1..20 scenes, total length 3..90 s (the engine rejects longer).
 *   - A scene background is an image or a video from the workspace `media` bucket, a solid colour, or a gradient.
 *   - Per scene: `caption` (burned in, bottom), `text` (big headline, centred; meant for colour/gradient cards), `voiceover` (Vietnamese TTS).
 *   - `transition` is how this scene LEAVES into the next one (ignored on the last scene).
 *   - Assets are named by their path inside the bucket `media` ("<workspace_id>/<file>") or by a Supabase Storage URL of that bucket;
 *     the validator normalises both to the bare path and refuses any path outside the workspace folder.
 */

export const VIDEO_SPEC_VERSION = 1;
export const VIDEO_MAX_SECONDS = 90;
export const VIDEO_MAX_SCENES = 20;

export const ASPECTS = ["9:16", "1:1", "16:9"] as const;
export type Aspect = (typeof ASPECTS)[number];

export const TRANSITIONS = ["fade", "slide", "wipe", "zoom", "none"] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const MOTIONS = ["zoom-in", "zoom-out", "pan-left", "pan-right", "none"] as const;
export type Motion = (typeof MOTIONS)[number];

/** Royalty-free tracks synthesised for NIVO (CC0, see resources/video/LICENSES.md). The files live in engine/assets/video/music. */
export const MUSIC_TRACKS = [
  { id: "sunny-pop", label: "Sunny pop (vui, nhanh)", bpm: 112 },
  { id: "calm-glow", label: "Calm glow (nhẹ nhàng, sang)", bpm: 72 },
  { id: "bold-beat", label: "Bold beat (mạnh, khuyến mãi)", bpm: 124 },
] as const;
export type MusicTrackId = (typeof MUSIC_TRACKS)[number]["id"];

export const TTS_VOICES = ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"] as const;
export type TtsVoice = (typeof TTS_VOICES)[number];

export type SceneBackground =
  | { readonly type: "image"; readonly src: string; readonly motion: Motion }
  | { readonly type: "video"; readonly src: string; readonly start_s: number }
  | { readonly type: "color"; readonly color: string }
  | { readonly type: "gradient"; readonly from: string; readonly to: string };

export type Scene = {
  readonly background: SceneBackground;
  /** Big centred headline (cards). Optional on any scene. */
  readonly text: string;
  /** Burned-in caption near the bottom. */
  readonly caption: string;
  /** Spoken in Vietnamese by the TTS. Empty = silent scene. */
  readonly voiceover: string;
  /** Seconds the scene is shown; 0 = automatic (voiceover length, else reading time of the text). 1.5..15 otherwise. */
  readonly duration_s: number;
  readonly transition: Transition;
};

export type Brand = {
  readonly name: string;
  /** #RRGGBB accent colour (caption highlight, name chip). */
  readonly primary: string;
  readonly secondary: string;
  /** Path of a logo (png/jpg/webp with transparency welcome) in the `media` bucket, or null. */
  readonly logo: string | null;
};

export type VideoSpec = {
  readonly version: 1;
  readonly aspect: Aspect;
  readonly scenes: ReadonlyArray<Scene>;
  readonly brand: Brand;
  readonly music: { readonly track: MusicTrackId; readonly volume: number } | null;
  readonly voice: { readonly enabled: boolean; readonly name: TtsVoice; readonly rate_pct: number };
  readonly captions: boolean;
};

export type SpecResult = { readonly ok: true; readonly spec: VideoSpec } | { readonly ok: false; readonly errors: ReadonlyArray<string> };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(CONTROL, "").replace(/\r/g, "").trim().slice(0, max) : "");

/** #RGB or #RRGGBB (any case) -> #RRGGBB lower case, or null. */
export const normaliseColor = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `#${h.length === 3 ? h.split("").map((c) => c + c).join("") : h}`;
};

/**
 * An asset reference -> the bare path inside the `media` bucket, or null. Accepts the path itself or a Supabase Storage URL
 * (.../storage/v1/object/{sign|authenticated|public}/media/<path>[?token]). `workspaceId` (when given) must be the first path segment.
 */
export const mediaPathOf = (v: unknown, workspaceId?: string): string | null => {
  if (typeof v !== "string") return null;
  let p = v.trim();
  if (/^https?:\/\//i.test(p)) {
    let url: URL;
    try {
      url = new URL(p);
    } catch {
      return null;
    }
    const m = url.pathname.match(/\/storage\/v1\/object\/(?:sign\/|authenticated\/|public\/)?media\/(.+)$/);
    if (!m) return null;
    try {
      p = decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }
  p = p.replace(/^\/+/, "");
  if (!p || p.length > 300 || p.split("/").some((s) => s === ".." || s === "." || s === "") || /[\u0000-\u001f\\]/.test(p)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.+/i.test(p)) return null;
  if (workspaceId && !p.toLowerCase().startsWith(`${workspaceId.toLowerCase()}/`)) return null;
  return p;
};

const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const pick = <T extends string>(v: unknown, allowed: ReadonlyArray<T>, fallback: T): T => (typeof v === "string" && (allowed as ReadonlyArray<string>).includes(v) ? (v as T) : fallback);

/** Rough reading/speaking time, used for the length estimate only (the engine measures the real voice). */
export const estimateSceneSeconds = (s: Pick<Scene, "caption" | "text" | "voiceover" | "duration_s">): number => {
  if (s.duration_s > 0) return s.duration_s;
  const spoken = s.voiceover.length / 14 + 0.8;
  const read = (s.caption.length + s.text.length) / 16 + 1.2;
  return Math.min(15, Math.max(2.5, spoken, read, 3));
};

/** Validate and normalise untrusted input. Never throws. `opts.workspaceId` pins every asset path to that workspace folder. */
export const validateVideoSpec = (input: unknown, opts: { readonly workspaceId?: string } = {}): SpecResult => {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["spec must be an object"] };
  const aspect = pick(input.aspect, ASPECTS, "9:16");
  if (input.aspect !== undefined && input.aspect !== aspect) errors.push(`aspect must be one of ${ASPECTS.join(", ")}`);

  const rawScenes = Array.isArray(input.scenes) ? input.scenes : [];
  if (rawScenes.length < 1) errors.push("scenes: at least one scene is required");
  if (rawScenes.length > VIDEO_MAX_SCENES) errors.push(`scenes: at most ${VIDEO_MAX_SCENES} scenes`);

  const assetPath = (v: unknown, where: string): string => {
    const p = mediaPathOf(v, opts.workspaceId);
    if (!p) errors.push(`${where}: must be a path or Storage URL inside this workspace's media folder`);
    return p ?? "";
  };

  const scenes: Scene[] = rawScenes.slice(0, VIDEO_MAX_SCENES).map((raw, i): Scene => {
    const at = `scenes[${i}]`;
    const o = isObj(raw) ? raw : {};
    if (!isObj(raw)) errors.push(`${at}: must be an object`);
    const bg = isObj(o.background) ? o.background : {};
    const type = pick(bg.type, ["image", "video", "color", "gradient"] as const, "color");
    if (!isObj(o.background) || bg.type !== type) errors.push(`${at}.background.type must be image, video, color or gradient`);
    let background: SceneBackground;
    if (type === "image") background = { type, src: assetPath(bg.src, `${at}.background.src`), motion: pick(bg.motion, MOTIONS, "zoom-in") };
    else if (type === "video") background = { type, src: assetPath(bg.src, `${at}.background.src`), start_s: num(bg.start_s, 0, 0, 600) };
    else if (type === "gradient") {
      const from = normaliseColor(bg.from);
      const to = normaliseColor(bg.to);
      if (!from || !to) errors.push(`${at}.background: gradient needs from and to as #RRGGBB`);
      background = { type, from: from ?? "#222222", to: to ?? "#555555" };
    } else {
      const color = normaliseColor(bg.color);
      if (!color) errors.push(`${at}.background.color must be #RRGGBB`);
      background = { type, color: color ?? "#222222" };
    }
    const duration = num(o.duration_s, 0, 0, 15);
    if (duration !== 0 && duration < 1.5) errors.push(`${at}.duration_s must be 0 (automatic) or between 1.5 and 15`);
    return {
      background,
      text: clean(o.text, 120),
      caption: clean(o.caption, 160),
      voiceover: clean(o.voiceover, 420),
      duration_s: duration === 0 ? 0 : Math.max(1.5, duration),
      transition: pick(o.transition, TRANSITIONS, "fade"),
    };
  });

  const b = isObj(input.brand) ? input.brand : {};
  const name = clean(b.name, 60);
  if (!name) errors.push("brand.name is required");
  const brand: Brand = {
    name,
    primary: normaliseColor(b.primary) ?? "#16a34a",
    secondary: normaliseColor(b.secondary) ?? "#0f172a",
    logo: b.logo === undefined || b.logo === null || b.logo === "" ? null : assetPath(b.logo, "brand.logo") || null,
  };

  let music: VideoSpec["music"] = null;
  if (isObj(input.music)) {
    const ids = MUSIC_TRACKS.map((t) => t.id);
    const track = pick(input.music.track, ids, ids[0]);
    if (input.music.track !== track) errors.push(`music.track must be one of ${ids.join(", ")}`);
    music = { track, volume: num(input.music.volume, 0.5, 0.05, 1) };
  } else if (input.music !== undefined && input.music !== null) {
    errors.push("music must be null or { track, volume }");
  }

  const v = isObj(input.voice) ? input.voice : {};
  const voice = { enabled: v.enabled !== false, name: pick(v.name, TTS_VOICES, "vi-VN-HoaiMyNeural"), rate_pct: Math.round(num(v.rate_pct, 0, -30, 30)) };

  const total = scenes.reduce((sum, s) => sum + estimateSceneSeconds(s), 0);
  if (scenes.length > 0 && total > VIDEO_MAX_SECONDS) errors.push(`video would be about ${Math.round(total)} s; the maximum is ${VIDEO_MAX_SECONDS} s`);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, spec: { version: 1, aspect, scenes, brand, music, voice, captions: input.captions !== false } };
};

/** Output pixel size for an aspect (1080 on the short side for 9:16 and 1:1, 1080p for 16:9). */
export const aspectSize = (a: Aspect): { readonly width: number; readonly height: number } => (a === "9:16" ? { width: 1080, height: 1920 } : a === "1:1" ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 });

/* ------------------------------------------------------------------ the contract around the spec */

export type RenderStatus = "queued" | "rendering" | "done" | "failed";

/** One row of `video_renders` as members read it. */
export type RenderRow = {
  readonly id: string;
  readonly workspace_id: string;
  readonly spec: VideoSpec;
  readonly status: RenderStatus;
  readonly progress: number;
  readonly stage: string | null;
  readonly output_path: string | null;
  readonly poster_path: string | null;
  readonly duration_ms: number | null;
  readonly size_bytes: number | null;
  readonly error: string | null;
  readonly meta: Record<string, unknown>;
  readonly created_by: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly started_at: string | null;
  readonly finished_at: string | null;
};

/** The `media` bucket (private, per workspace): where images, videos and logos for a render are uploaded. */
export const MEDIA_BUCKET = "media";
export const VIDEOS_BUCKET = "videos";
export const MEDIA_MAX_BYTES = 50 * 1024 * 1024;
export const MEDIA_MIME = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"] as const;
