import "server-only";
import { generateWithOpenClaw } from "./openclaw-generate";

/**
 * The ONE place automations ask a model to write text. OpenClaw is the only text-generating AI of the product: this adapter calls `generateWithOpenClaw`
 * (engine job `openclaw.generate`) and returns null when it cannot answer, so callers keep their deterministic fallback. It must never call src/lib/deepseek.ts.
 */
export type GenerateRequest = {
  readonly workspaceId: string;
  /** What the text is for: "personalize" (once, at enable time) or "per_case" (one customer message) or "classify" (a one-word label). */
  readonly purpose: "personalize" | "per_case" | "classify";
  readonly system: string;
  readonly prompt: string;
};

export const GENERATION_ENABLED = true;

/**
 * Text for an automation, written by OpenClaw (engine job `openclaw.generate`) through `generateWithOpenClaw`. Returns null when OpenClaw cannot answer in time
 * (engine down, over the plan allowance, timeout): every caller then uses its deterministic text, so an automation never fails only because of the model.
 */
export const generateText = async (req: GenerateRequest): Promise<string | null> => {
  if (!GENERATION_ENABLED) return null;
  const r = await generateWithOpenClaw({
    workspaceId: req.workspaceId, purpose: `automation_${req.purpose}`, kind: "engine", module: "other", timeoutMs: 40_000,
    messages: [{ role: "system", content: req.system }, { role: "user", content: req.prompt }],
  });
  return r.ok ? r.output.trim() || null : null;
};
