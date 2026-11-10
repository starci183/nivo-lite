import type { RunView } from "@modules/domain/agent-runs"

/** The kinds of fault. Each has one injector in the harness; a new fault is one entry in both. */
export type FaultKind =
    | "hang-kill"
    | "abort-after"
    | "kill-after-approval"
    | "runtime-down"
    | "tool-unknown"
    | "duplicate-message"
    | "double-approval"
    | "connector-timeout"
    | "reload"
    | "graceful-shutdown"

/** A step boundary: the handler a worker stops in, and whether the effect happened. */
export interface Boundary {
    /** The handler kind. */
    readonly handler: string
    /** Before its effect, or after it and before its result is stored. */
    readonly phase: "before" | "after"
}

/** Where and how a run is hurt. */
export interface Fault {
    /** The kind. */
    readonly kind: FaultKind
    /** The boundary, for the kinds that stop a worker at one. */
    readonly at?: Boundary
}

/** The steps a run is first given. */
export type Chain = "customer" | "approval"

/** What every row asserts about the world once the fault is over. */
export interface Expected {
    /** The steps in order, as `key:status`. No loss: the run is where it should be. */
    readonly steps: ReadonlyArray<string>
    /** How many times each kind of effect happened, by the prefix the scripted world records (`door`, `tool`, `reply`). No duplicate. */
    readonly effects: Readonly<Record<string, number>>
    /** Where the run ended or waits. */
    readonly runStatus: RunView["status"]
    /** What a person was told by the dead letter, in order: the honest line where someone waits; empty where nobody does. */
    readonly told: ReadonlyArray<string>
    /** The node the run trace names as the last one reached. */
    readonly reached: string
}

/** One row of the failure table. */
export interface FailureCase {
    /** The id, `group/name`. */
    readonly id: string
    /** The steps it starts with. */
    readonly chain: Chain
    /** The fault. */
    readonly fault: Fault
    /** What must hold. */
    readonly expected: Expected
}

const ALL_DONE = ["turn:done", "door:done", "tool:done", "reply:done"]
const ONCE = { door: 1, tool: 1, reply: 1 }
const REACHED_REPLY = "node-reply"

const survives = (id: string, fault: Fault, over: Partial<Expected> = {}): FailureCase => ({
    id,
    chain: "customer",
    fault,
    expected: { steps: ALL_DONE, effects: ONCE, runStatus: "done", told: [], reached: REACHED_REPLY, ...over },
})

const approved = (id: string, fault: Fault): FailureCase => ({
    id,
    chain: "approval",
    fault,
    expected: {
        steps: ["ask:done", "reply:done"],
        effects: { reply: 1 },
        runStatus: "done",
        told: [],
        reached: REACHED_REPLY,
    },
})

/** The seven cases the owner named. */
export const OWNER_CASES: ReadonlyArray<FailureCase> = [
    survives("owner/api-killed-during-model-answer", { kind: "hang-kill", at: { handler: "turn", phase: "before" } }),
    survives("owner/killed-between-handover-and-reply", {
        kind: "abort-after",
        at: { handler: "door", phase: "after" },
    }),
    approved("owner/killed-after-approval-before-delivery", { kind: "kill-after-approval" }),
    survives("owner/runtime-stopped-mid-turn", { kind: "runtime-down" }),
    survives("owner/duplicate-message", { kind: "duplicate-message" }),
    approved("owner/double-approval", { kind: "double-approval" }),
    survives("owner/browser-reload", { kind: "reload" }),
]

/** The earlier kill cases. */
export const KILL_CASES: ReadonlyArray<FailureCase> = [
    survives("kill/after-tool-call-before-result", { kind: "hang-kill", at: { handler: "tool", phase: "after" } }),
    survives("kill/between-result-and-reply", { kind: "abort-after", at: { handler: "tool", phase: "after" } }),
    survives("kill/reply-sent-not-stored", { kind: "hang-kill", at: { handler: "reply", phase: "after" } }),
    survives("kill/connector-timeout", { kind: "connector-timeout" }),
    survives(
        "kill/tool-outcome-unknown",
        { kind: "tool-unknown" },
        {
            steps: ["turn:done", "door:done", "tool:failed"],
            effects: { door: 1 },
            runStatus: "parked",
            told: ["tool:tool_outcome_unknown"],
            reached: "node-door",
        },
    ),
]

/** The recovery rows. */
export const RECOVERY_CASES: ReadonlyArray<FailureCase> = [
    survives("recovery/hard-kill-recovers-through-the-sweeper", {
        kind: "hang-kill",
        at: { handler: "turn", phase: "before" },
    }),
    survives(
        "recovery/graceful-shutdown-drains-or-releases",
        { kind: "graceful-shutdown" },
        {
            steps: ["turn:done", "door:pending"],
            effects: {},
            runStatus: "running",
            reached: "node-turn",
        },
    ),
]
