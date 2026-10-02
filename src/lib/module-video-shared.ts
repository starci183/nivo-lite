/**
 * "Tạo video": types and pure helpers (no I/O, safe in client components).
 * The goal templates are DATA: resources/video/templates/goals/<goal>.json (scene structure per goal, generic for any business).
 * A project holds an editable script (scenes) that is turned into the render lane's VideoSpec (src/lib/video/spec.ts) when the owner presses "Dựng video".
 */
import behindScenes from "../../resources/video/templates/goals/behind_scenes.json";
import custom from "../../resources/video/templates/goals/custom.json";
import hiring from "../../resources/video/templates/goals/hiring.json";
import offer from "../../resources/video/templates/goals/offer.json";
import service from "../../resources/video/templates/goals/service.json";
import testimonial from "../../resources/video/templates/goals/testimonial.json";
import { estimateSceneSeconds, MUSIC_TRACKS, normaliseColor, TTS_VOICES, type Aspect, type Scene, type SceneBackground, type VideoSpec } from "./video/spec";

export type Goal = "service" | "offer" | "testimonial" | "behind_scenes" | "hiring" | "custom";
export type SceneRole = "hook" | "body" | "cta";
export type ProjectStatus = "draft" | "scripting" | "rendering" | "ready" | "approved" | "published" | "archived";
export type L = { readonly vi: string; readonly en: string };

export type GoalTemplate = {
  readonly goal: Goal;
  readonly order: number;
  readonly label: L;
  readonly hint: L;
  readonly default_seconds: number;
  readonly default_aspect: Aspect;
  readonly music: string | null;
  readonly scenes: ReadonlyArray<{ readonly role: SceneRole; readonly brief: string }>;
};

export const GOAL_TEMPLATES: ReadonlyArray<GoalTemplate> = ([service, offer, testimonial, behindScenes, hiring, custom] as unknown as ReadonlyArray<GoalTemplate>).slice().sort((a, b) => a.order - b.order);
export const GOALS: ReadonlyArray<Goal> = GOAL_TEMPLATES.map((t) => t.goal);
export const isGoal = (v: unknown): v is Goal => typeof v === "string" && (GOALS as ReadonlyArray<string>).includes(v);
export const templateOf = (goal: Goal): GoalTemplate => GOAL_TEMPLATES.find((t) => t.goal === goal) ?? GOAL_TEMPLATES[GOAL_TEMPLATES.length - 1];

export const DURATIONS: ReadonlyArray<number> = [15, 20, 30, 45, 60];
export const ASPECT_CHOICES: ReadonlyArray<{ readonly value: Aspect; readonly vi: string; readonly en: string }> = [
  { value: "9:16", vi: "Dọc 9:16 (TikTok, Reels, Zalo)", en: "Vertical 9:16 (TikTok, Reels, Zalo)" },
  { value: "1:1", vi: "Vuông 1:1 (Facebook)", en: "Square 1:1 (Facebook)" },
  { value: "16:9", vi: "Ngang 16:9 (YouTube, website)", en: "Wide 16:9 (YouTube, website)" },
];

export const STATUS_ORDER: ReadonlyArray<ProjectStatus> = ["draft", "scripting", "rendering", "ready", "approved", "published", "archived"];

/** One scene of the script the owner edits. */
export type ScriptScene = {
  readonly id: string;
  readonly role: SceneRole;
  /** On-screen words (burned-in caption, or the big headline when the scene has no photo/clip). */
  readonly caption: string;
  /** What the voice says. Empty = silent scene. */
  readonly voiceover: string;
  /** A suggestion of what to show (words, for the owner). */
  readonly visual: string;
  /** Path in the `media` bucket, or null = a colour card in the brand colours. */
  readonly media: string | null;
};

export type Brand = {
  readonly shopName: string;
  readonly primary: string;
  readonly secondary: string;
  readonly logoPath: string | null;
  readonly musicTrack: string | null;
  readonly voice: string;
};

export const DEFAULT_BRAND: Brand = { shopName: "", primary: "#16a34a", secondary: "#0f172a", logoPath: null, musicTrack: null, voice: "vi-VN-HoaiMyNeural" };

export type ProjectInputs = {
  /** Knowledge sources (public) the video is based on. */
  readonly sourceIds: ReadonlyArray<string>;
  /** What the owner wants to stress, in their words. */
  readonly notes: string;
  /** Uploaded media (paths in the `media` bucket) offered to the script. */
  readonly media: ReadonlyArray<string>;
  /** Created by an automation (not by a person). */
  readonly auto: boolean;
};

export const EMPTY_INPUTS: ProjectInputs = { sourceIds: [], notes: "", media: [], auto: false };

export const readInputs = (raw: unknown): ProjectInputs => {
  const o = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const strings = (v: unknown, max: number): Array<string> => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 300).slice(0, max) : []);
  return {
    sourceIds: strings(o.source_ids ?? o.sourceIds, 12),
    notes: typeof o.notes === "string" ? o.notes.slice(0, 600) : "",
    media: strings(o.media, 40),
    auto: o.auto === true,
  };
};
export const writeInputs = (i: ProjectInputs): Record<string, unknown> => ({ source_ids: i.sourceIds, notes: i.notes, media: i.media, auto: i.auto });

const newId = (): string => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
export const newScene = (role: SceneRole = "body"): ScriptScene => ({ id: newId(), role, caption: "", voiceover: "", visual: "", media: null });

const clip = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const ROLES: ReadonlyArray<SceneRole> = ["hook", "body", "cta"];

/** Whatever is stored or typed -> clean scenes (at most 12). Never throws. */
export const readScript = (raw: unknown): Array<ScriptScene> => {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).flatMap((r): Array<ScriptScene> => {
    if (typeof r !== "object" || r === null) return [];
    const o = r as Record<string, unknown>;
    const caption = clip(o.caption, 160);
    const voiceover = clip(o.voiceover, 420);
    if (!caption && !voiceover) return [];
    return [{
      id: typeof o.id === "string" && o.id ? o.id.slice(0, 60) : newId(),
      role: (ROLES as ReadonlyArray<unknown>).includes(o.role) ? (o.role as SceneRole) : "body",
      caption, voiceover, visual: clip(o.visual, 200),
      media: typeof o.media === "string" && o.media ? o.media.slice(0, 300) : null,
    }];
  });
};

/** What OpenClaw returns -> a title and scenes. It may wrap the JSON in a code fence or prose; the first balanced object is used. */
export const parseScriptOutput = (text: string): { readonly ok: true; readonly title: string; readonly scenes: Array<ScriptScene> } | { readonly ok: false; readonly error: string } => {
  const body = text.replace(/```(?:json)?/gi, "").trim();
  const start = body.indexOf("{");
  if (start < 0) return { ok: false, error: "no JSON object" };
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === "\"") inString = false;
    } else if (c === "\"") inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) { end = i; break; }
  }
  if (end < 0) return { ok: false, error: "JSON is cut off" };
  let json: unknown;
  try {
    json = JSON.parse(body.slice(start, end + 1));
  } catch {
    return { ok: false, error: "JSON does not parse" };
  }
  const o = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  const scenes = readScript(o.scenes).map((s, i, all) => ({ ...s, role: i === 0 ? "hook" as const : i === all.length - 1 && all.length > 1 ? "cta" as const : s.role === "hook" || s.role === "cta" ? "body" as const : s.role }));
  if (scenes.length < 2) return { ok: false, error: "fewer than 2 scenes" };
  return { ok: true, title: clip(o.title, 120), scenes };
};

export const mediaKindOf = (path: string): "video" | "image" => (/\.(mp4|mov|webm)$/i.test(path) ? "video" : "image");

/** The name shown for an uploaded file: "<uuid>-anh-1.jpg" -> "anh-1.jpg". */
export const mediaLabel = (path: string): string => path.split("/").pop()?.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "") ?? path;

/** Rough length of the video from the script (the engine measures the real voice). */
export const estimateScriptSeconds = (scenes: ReadonlyArray<ScriptScene>): number =>
  Math.round(scenes.reduce((sum, s) => sum + estimateSceneSeconds({ caption: s.caption, text: "", voiceover: s.voiceover, duration_s: 0 }), 0));

/** The render lane's spec from the script + brand. Not validated: callers pass it to validateVideoSpec / enqueueRender. */
export const buildVideoSpec = (a: { readonly scenes: ReadonlyArray<ScriptScene>; readonly aspect: Aspect; readonly brand: Brand; readonly goal: Goal; readonly shopFallback: string }): unknown => {
  const primary = normaliseColor(a.brand.primary) ?? DEFAULT_BRAND.primary;
  const secondary = normaliseColor(a.brand.secondary) ?? DEFAULT_BRAND.secondary;
  const scenes = a.scenes.map((s, i): Scene => {
    let background: SceneBackground;
    if (s.media) background = mediaKindOf(s.media) === "video" ? { type: "video", src: s.media, start_s: 0 } : { type: "image", src: s.media, motion: i % 2 === 0 ? "zoom-in" : "pan-left" };
    else background = i % 2 === 0 ? { type: "gradient", from: primary, to: secondary } : { type: "gradient", from: secondary, to: primary };
    return {
      background,
      // A colour card has no picture to show: the words go big in the middle. With a photo or clip they are the caption at the bottom.
      text: s.media ? "" : s.caption.slice(0, 120),
      caption: s.media ? s.caption : "",
      voiceover: s.voiceover,
      duration_s: 0,
      transition: "fade",
    };
  });
  const track = (MUSIC_TRACKS as ReadonlyArray<{ id: string }>).some((t) => t.id === a.brand.musicTrack) ? a.brand.musicTrack : null;
  const voice = (TTS_VOICES as ReadonlyArray<string>).includes(a.brand.voice) ? a.brand.voice : DEFAULT_BRAND.voice;
  const spec = {
    version: 1,
    aspect: a.aspect,
    scenes,
    brand: { name: a.brand.shopName || a.shopFallback, primary, secondary, logo: a.brand.logoPath },
    music: track ? { track, volume: 0.45 } : null,
    voice: { enabled: true, name: voice, rate_pct: 0 },
    captions: true,
  };
  return spec as unknown as VideoSpec;
};

/* ------------------------------------------------------------------ the views the screens share */

export type RenderView = {
  readonly id: string;
  readonly status: "queued" | "rendering" | "done" | "failed";
  readonly progress: number;
  readonly stage: string | null;
  readonly durationMs: number | null;
  readonly sizeBytes: number | null;
  readonly error: string | null;
  readonly videoUrl: string | null;
  readonly downloadUrl: string | null;
  readonly posterUrl: string | null;
};

export type ProjectView = {
  readonly id: string;
  readonly title: string;
  readonly goal: Goal;
  readonly aspect: Aspect;
  readonly targetSeconds: number;
  readonly status: ProjectStatus;
  readonly inputs: ProjectInputs;
  readonly script: ReadonlyArray<ScriptScene>;
  readonly version: number;
  readonly scriptMs: number | null;
  readonly lastError: string | null;
  readonly render: RenderView | null;
  readonly renderCount: number;
  readonly approvedAt: string | null;
  readonly approvedByName: string | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SourceChoice = { readonly id: string; readonly title: string; readonly topic: string | null; readonly excerpt: string };
export type MediaItem = { readonly path: string; readonly name: string; readonly kind: "image" | "video"; readonly url: string | null };
