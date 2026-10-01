import "server-only";

/**
 * The ONE place automations ask a model to write text. OpenClaw is the only text-generating AI of the product: the OpenClaw lane's helper
 * `generateWithOpenClaw(...)` (engine job `openclaw.generate`, asynchronous) is the intended implementation. It is not on main yet, so this adapter is DISABLED:
 * it returns null and every caller falls back to deterministic text (the approved template with its variables filled), which is also what `fixed` templates always do.
 *
 * TODO(openclaw): when `generateWithOpenClaw` lands, call it here (system + prompt in, plain text out; the call is async, so enqueue, and let the run wait
 * as "running" until the job completes or time out to the fallback) and delete the early return. Nothing else in the automations needs to change.
 * This module must never call src/lib/deepseek.ts.
 */
export type GenerateRequest = {
  readonly workspaceId: string;
  /** What the text is for: "personalize" (once, at enable time) or "per_case" (one customer message) or "classify" (a one-word label). */
  readonly purpose: "personalize" | "per_case" | "classify";
  readonly system: string;
  readonly prompt: string;
};

export const GENERATION_ENABLED = false;

export const generateText = async (_req: GenerateRequest): Promise<string | null> => {
  if (!GENERATION_ENABLED) return null;
  return null;
};
