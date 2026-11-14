import { isRecord } from "@modules/platform/primitives"
import { LanggraphError, LanggraphErrorCode } from "./errors/langgraph.error"
import type { ThreadRef, ThreadStart, ThreadState, ThreadStop, ThreadUpdate } from "./langgraph.port"
import { requirePlain } from "./plain.policy"

/** The two values the engine keeps beside the state of a thread, in the same checkpoint. */
export interface ThreadMarks {
    /** The version the thread started on. */
    readonly pin: string
    /** The key of the node that runs next, or the end key once nothing is left. */
    readonly cursor: string
}

/** What a thread holds: the state the nodes see, and the engine's own marks. */
export interface ThreadHeld {
    /** The state the nodes see. */
    readonly state: ThreadState
    /** The engine's marks. */
    readonly marks: ThreadMarks
}

/** The keys of the state a node may write. */
const WRITABLE = ["steps", "trouble", "founderAnswers", "loop", "branches"] as const

/** The keys of the state a node of a fan-out branch may write: the two that merge by key, so parallel branches never collide. */
const BRANCH_WRITABLE: ReadonlySet<string> = new Set(["steps", "branches"])

/** The values a new thread starts with: the trigger, every other key of the state empty, and the engine's marks. */
export const openingOf = (input: ThreadStart, marks: ThreadMarks): Readonly<Record<string, unknown>> => {
    requirePlain(input.trigger, "start.trigger")
    return { trigger: input.trigger, steps: {}, trouble: null, founderAnswers: [], loop: null, ...marks }
}

/** A node's update as the values to write: only the keys it named, checked to be plain JSON. */
export const writesOf = (update: ThreadUpdate | undefined): Readonly<Record<string, unknown>> => {
    if (update === undefined) return {}
    requirePlain(update, "update")
    return Object.fromEntries(WRITABLE.filter((key) => update[key] !== undefined).map((key) => [key, update[key]]))
}

/** How `steps` takes an update: the keys it names are added or replaced, the others stay. */
export const mergeSteps = (
    held: Readonly<Record<string, unknown>>,
    added: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => ({ ...held, ...added })

/** How `branches` takes an update: the ids it names are added or replaced, the others stay; `null` empties it. */
export const mergeBranches = (
    held: Readonly<Record<string, unknown>>,
    added: Readonly<Record<string, unknown>> | null,
): Readonly<Record<string, unknown>> => (added === null ? {} : { ...held, ...added })

/** The first key of a branch's writes that a branch may not write (`trouble`, `founderAnswers`, `loop`), or null when there is none. */
export const branchWriteRefusedOf = (writes: Readonly<Record<string, unknown>>): string | null =>
    Object.keys(writes).find((key) => !BRANCH_WRITABLE.has(key)) ?? null

/**
 * The input of a branch a node sends: the values the sending node saw with its own writes applied (its `steps` merged, any other key it
 * wrote replaced), the branch records left out (no node of a branch reads them; they stay in the shared state), and the branch's value.
 */
export const branchInputOf = (
    values: Readonly<Record<string, unknown>>,
    writes: Readonly<Record<string, unknown>>,
    branch: unknown,
): Readonly<Record<string, unknown>> => {
    const held = isRecord(values.steps) ? values.steps : {}
    const added = isRecord(writes.steps) ? writes.steps : {}
    return { ...values, ...writes, steps: mergeSteps(held, added), branches: {}, branch }
}

/**
 * Reads the values of a checkpoint (or the result of a run) as a thread of this engine.
 *
 * @param values - The values as the library hands them.
 * @param thread - The thread, named in the refusal.
 * @returns The state and the engine's marks.
 * @throws {LanggraphError} `LANGGRAPH_THREAD_UNREADABLE` when the values carry no pin, no cursor or no step record.
 */
export const heldOf = (values: unknown, thread: ThreadRef): ThreadHeld => {
    if (!isRecord(values) || typeof values.pin !== "string" || typeof values.cursor !== "string" || !isRecord(values.steps))
        throw new LanggraphError({ code: LanggraphErrorCode.ThreadUnreadable, params: { thread: thread.runId } })
    return {
        state: {
            trigger: values.trigger ?? null,
            steps: values.steps,
            trouble: values.trouble ?? null,
            founderAnswers: Array.isArray(values.founderAnswers) ? values.founderAnswers : [],
            loop: values.loop ?? null,
            // Only a fan-out has branch records, and only a run a `Send` started has a branch: a thread without either reads as it did.
            ...(isRecord(values.branches) && Object.keys(values.branches).length > 0 ? { branches: values.branches } : {}),
            ...(values.branch === undefined || values.branch === null ? {} : { branch: values.branch }),
        },
        marks: { pin: values.pin, cursor: values.cursor },
    }
}

/** Reads what a node handed `scope.stop` back from the library's interrupt records; null when none carries a stop of this engine. */
export const stopOf = (interrupts: unknown): ThreadStop | null => {
    const first: unknown = Array.isArray(interrupts) ? interrupts[0] : interrupts
    const value: unknown = isRecord(first) ? first.value : undefined
    return isRecord(value) && typeof value.node === "string" ? { node: value.node, question: value.question ?? null } : null
}
