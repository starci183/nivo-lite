import type { AgentHandlerEnding, AgentTriggerPreset, AgentWakeContext } from "@modules/domain/agent-work"
import { periodMsOf } from "./agent-schedules.policy"

/** Why a background wake ends without a turn: the agent is gone or paused. */
export const AGENT_INACTIVE = "agent_inactive"
/** Why a background wake ends without a turn: the agent holds no applied version, or its installation does not run. */
export const NOT_APPLIED = "not_applied"
/** Why a schedule wake ends without a turn: its slot is older than the period of its own trigger. */
export const STALE_SLOT = "stale"

/** The reasons a turn that cannot run ends a background wake as skipped; the next fire or sweep is the retry, never a replay. */
const SKIPPED_REASONS: ReadonlySet<string> = new Set(["quota", "breaker", "daily_cap", "openclaw_not_configured"])

/** A background wake ended without a turn, with the reason. */
export const skippedBy = (reason: string): AgentHandlerEnding => ({ status: "skipped", reason, outcome: null })

/**
 * How a background wake ends when a turn cannot run. Nobody waits on a clock or an event, so the wake is skipped with the reason and no
 * line goes to anyone; a switch that is off holds it, as the drain already does.
 */
export const holdEndingOf = (reason: string): AgentHandlerEnding =>
    reason === "killed"
        ? { status: "held", reason, outcome: null }
        : { status: "skipped", reason: SKIPPED_REASONS.has(reason) ? reason : "unavailable", outcome: null }

/** True when a schedule wake's slot (epoch ms) is older than one period of its trigger, so a backlog never replays. */
export const isStaleSlot = (slot: string | undefined, preset: AgentTriggerPreset | null, now: Date): boolean => {
    if (slot === undefined || preset === null) return false
    const at = Number(slot)
    return Number.isFinite(at) && now.getTime() - at > periodMsOf(preset)
}

/**
 * The words a background turn starts from, built from the ids and flags of the wake and the brief a probe wrote: what woke the agent
 * and about which record, never the words of a customer.
 */
export const wakeTextOf = (context: AgentWakeContext, brief: string | null): string =>
    [
        brief,
        context.eventName === undefined ? null : `event: ${context.eventName}`,
        context.subjectId === undefined ? null : `subject: ${context.subjectId}`,
        context.taskId === undefined ? null : `task: ${context.taskId}`,
        context.probeKey === undefined ? null : `check: ${context.probeKey}`,
    ]
        .filter((line): line is string => line !== null && line !== "")
        .join("\n")

/** What an agent says to its owner after a turn: the reply, else the reason a person is wanted; empty when it has nothing to say. */
export const sayingOf = (reply: string, needsHuman: boolean, reason: string): string => {
    if (reply.trim() !== "") return reply.trim()
    return needsHuman ? reason.trim() : ""
}

/** A value a trigger carried, as text; anything missing is empty. */
export const textOf = (value: unknown): string => {
    if (typeof value === "string") return value
    return typeof value === "number" || typeof value === "boolean" ? String(value) : ""
}
