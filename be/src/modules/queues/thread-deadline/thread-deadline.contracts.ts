import { isRecord } from "@modules/platform/primitives"

/** The queue name: the contract between the producer and the processor of the thread-deadline job (the durable queue name). */
export const THREAD_DEADLINE_QUEUE = "thread_deadline"

/** The jobs of the thread-deadline queue; the value is the job name inside the queue. */
export enum ThreadDeadlineJob {
    /** The deadline of a stop of a thread came: the stop is answered `timeout` when it still stands as it did when the deadline was armed. */
    Fire = "thread-deadline.fire",
}

/** The payload of a fire job: ids and the state of the stop the deadline was armed for, never a person's words. */
export interface ThreadDeadlinePayload {
    /** The workspace: its job limit is keyed on it. */
    readonly workspaceId: string
    /** The run, which is the thread. */
    readonly runId: string
    /** The step whose stop waits. */
    readonly stepKey: string
    /** How many times that step had stopped when the deadline was armed. */
    readonly repeats: number
    /** How many answers its stop had then: the deadline fires only while it still has that many. */
    readonly answered: number
}

/** True when a job payload is the payload of a fire job. */
export const isThreadDeadlinePayload = (value: unknown): value is ThreadDeadlinePayload =>
    isRecord(value) &&
    typeof value.workspaceId === "string" &&
    typeof value.runId === "string" &&
    typeof value.stepKey === "string" &&
    typeof value.repeats === "number" &&
    typeof value.answered === "number"

/** The dedupe key of a deadline: one per stop as it stood (run, step, repeat, answers), so arming it again adds no second job. */
export const threadDeadlineKey = (payload: ThreadDeadlinePayload): string =>
    `thread-deadline:${payload.runId}:${payload.stepKey}:${String(payload.repeats)}.${String(payload.answered)}`
