"use server"

import { getLocale } from "@/i18n/server"
import { isManagerRole } from "../members-shared"
import { generateWithOpenClaw } from "../openclaw-generate"
import { getSession } from "../session"
import { answerGuide } from "./core"
import { loadGuideText } from "./text"
import type { GuideReply, GuideTurn } from "./types"

/**
 * Ask the NIVO guide. Any signed-in member may ask; the answer only links to pages their role may open. Model calls go through
 * OpenClaw (DeepSeek V4 Flash, one NIVO key) under the usage kind `guide`, which NIVO pays for: metered, never blocked, never counted
 * toward the workspace allowance. A member may ask the model at most AI_PER_WINDOW times per window; site-map answers are free.
 */

const AI_PER_WINDOW = 20
const WINDOW_MS = 10 * 60_000
const HISTORY_TURNS = 6
const TURN_LENGTH = 600
const PATH_LENGTH = 200
const MODEL_TIMEOUT_MS = 25_000
const recent = new Map<string, Array<number>>()

/** Take one model call from this member allowance; false when they asked too often (per server process, best effort). */
const takeAiCall = (key: string): boolean => {
    const now = Date.now()
    const kept = (recent.get(key) ?? []).filter((at) => now - at < WINDOW_MS)
    if (kept.length >= AI_PER_WINDOW) {
        recent.set(key, kept)
        return false
    }
    kept.push(now)
    recent.set(key, kept)
    return true
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The last turns of a conversation the browser sent, with anything malformed dropped. */
const cleanHistory = (raw: unknown): Array<GuideTurn> =>
    (Array.isArray(raw) ? raw : []).slice(-HISTORY_TURNS).flatMap((turn): Array<GuideTurn> => {
        if (!isRecord(turn) || typeof turn.text !== "string") return []
        if (turn.role !== "user" && turn.role !== "guide") return []
        return [{ role: turn.role, text: turn.text.slice(0, TURN_LENGTH) }]
    })

/** Answers one question of the guide for the signed-in member. */
export const askGuide = async (input: unknown): Promise<GuideReply> => {
    const session = await getSession()
    const locale = (await getLocale()) === "en" ? "en" : "vi"
    const key = `${session.workspace.id}:${session.userId}`
    const body = isRecord(input) ? input : {}
    return answerGuide(
        {
            question: typeof body.question === "string" ? body.question : "",
            path: typeof body.path === "string" ? body.path.slice(0, PATH_LENGTH) : "/",
            history: cleanHistory(body.history),
            isManager: isManagerRole(session.member.role),
        },
        await loadGuideText(locale),
        async (messages) => {
            if (!takeAiCall(key)) return { ok: false }
            const reply = await generateWithOpenClaw({
                workspaceId: session.workspace.id,
                purpose: "guide",
                kind: "guide",
                module: "other",
                responseFormat: "json",
                timeoutMs: MODEL_TIMEOUT_MS,
                messages,
            })
            return reply.ok ? { ok: true, output: reply.output } : { ok: false }
        },
    )
}
