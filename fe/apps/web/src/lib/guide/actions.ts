"use server";

import { getLocale } from "@/i18n/server";
import { isManagerRole } from "../members-shared";
import { generateWithOpenClaw } from "../openclaw-generate";
import { getSession } from "../session";
import { answerGuide } from "./core";
import type { GuideReply, GuideTurn } from "./types";

/**
 * Ask the NIVO guide. Any signed-in member may ask; the answer only links to pages their role may open. Model calls go through
 * OpenClaw (DeepSeek V4 Flash, NIVO's one key) under the usage kind `guide`, which NIVO pays for: metered, never blocked, never counted
 * toward the workspace's allowance. A member may ask the model at most AI_PER_WINDOW times per window; site-map answers are free.
 */

const AI_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60_000;
const recent = new Map<string, Array<number>>();

/** Take one model call from this member's allowance; false when they asked too often (per server process, best effort). */
const takeAiCall = (key: string): boolean => {
  const now = Date.now();
  const kept = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (kept.length >= AI_PER_WINDOW) {
    recent.set(key, kept);
    return false;
  }
  kept.push(now);
  recent.set(key, kept);
  return true;
};

const cleanHistory = (raw: unknown): Array<GuideTurn> =>
  (Array.isArray(raw) ? raw : []).slice(-6).flatMap((t): Array<GuideTurn> => {
    const turn = t as { role?: unknown; text?: unknown };
    return (turn.role === "user" || turn.role === "guide") && typeof turn.text === "string" ? [{ role: turn.role, text: turn.text.slice(0, 600) }] : [];
  });

export const askGuide = async (input: { question: string; path: string; history: ReadonlyArray<GuideTurn> }): Promise<GuideReply> => {
  const session = await getSession();
  const locale = (await getLocale()) === "en" ? "en" : "vi";
  const key = `${session.workspace.id}:${session.userId}`;
  return answerGuide(
    {
      question: String(input.question ?? ""),
      path: String(input.path ?? "/").slice(0, 200),
      history: cleanHistory(input.history),
      locale,
      isManager: isManagerRole(session.member.role),
    },
    async (messages) => {
      if (!takeAiCall(key)) return { ok: false };
      const r = await generateWithOpenClaw({
        workspaceId: session.workspace.id, purpose: "guide", kind: "guide", module: "other", responseFormat: "json", timeoutMs: 25_000, messages,
      });
      return r.ok ? { ok: true, output: r.output } : { ok: false };
    },
  );
};
