import { isRecord } from "@modules/platform/primitives"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import type { AgentRunStatus, AgentStepStatus, StepEffect, StepJson, StepView } from "./agent-runs.contracts"
import type { RunStepView, RunView } from "./agent-runs-engine.contracts"
import type { RunRecord, StepRecord } from "./agent-runs-records.contracts"
import type { RouteStep } from "./policies/failure-route.policy"

const RUN_STATUSES: ReadonlyArray<AgentRunStatus> = [
    "running",
    "waiting",
    "parked",
    "failed",
    "done",
    "dead",
    "compensating",
    "compensated",
    "cancelled",
]

const STEP_STATUSES: ReadonlyArray<AgentStepStatus> = [
    "pending",
    "running",
    "done",
    "failed",
    "compensating",
    "compensated",
]

const rejected = (): AgentRunsError => new AgentRunsError({ code: AgentRunsErrorCode.ResultRejected })

type Data = RecordRow["data"]

const textOf = (data: Data, key: string): string => {
    const value = data[key]
    if (typeof value !== "string") throw rejected()
    return value
}

const textOrNull = (data: Data, key: string): string | null => {
    const value = data[key]
    if (value === null || value === undefined) return null
    return textOf(data, key)
}

const intOf = (data: Data, key: string): number => {
    const value = data[key]
    if (typeof value !== "number") throw rejected()
    return value
}

const flagOf = (data: Data, key: string): boolean => {
    const value = data[key]
    if (typeof value !== "boolean") throw rejected()
    return value
}

const dateOrNull = (data: Data, key: string): Date | null => {
    const text = textOrNull(data, key)
    return text === null ? null : new Date(text)
}

const jsonOf = (data: Data, key: string): StepJson => {
    const value = data[key]
    if (!isRecord(value)) throw rejected()
    return value
}

const jsonOrNull = (data: Data, key: string): StepJson | null => {
    const value = data[key]
    return value === null || value === undefined ? null : jsonOf(data, key)
}

const effectOf = (data: Data): StepEffect => {
    const effect = jsonOf(data, "effect")
    if (effect.kind === "read") return { kind: "read" }
    if (effect.kind === "pivot") return { kind: "pivot" }
    if (effect.kind === "compensable" && typeof effect.compensation === "string")
        return { kind: "compensable", compensation: effect.compensation }
    throw rejected()
}

const enumOf = <T extends string>(data: Data, key: string, allowed: ReadonlyArray<T>): T => {
    const value = textOf(data, key)
    const found = allowed.find((candidate) => candidate === value)
    if (found === undefined) throw rejected()
    return found
}

/** The code an error object carries, or null. */
const codeOf = (data: Data): string | null => {
    const error = jsonOrNull(data, "error")
    return error !== null && typeof error.code === "string" ? error.code : null
}

/** A run record read from the engine's row. */
export const runRecordOf = (row: RecordRow): RunRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    version: row.version,
    agentId: textOf(row.data, "agentId"),
    wakeId: textOf(row.data, "wakeId"),
    trigger: textOf(row.data, "trigger"),
    graphVersionId: textOrNull(row.data, "graphVersionId"),
    planning: flagOf(row.data, "planning"),
    status: enumOf(row.data, "status", RUN_STATUSES),
    context: jsonOf(row.data, "context"),
    errorCode: codeOf(row.data),
    deadLetteredAt: dateOrNull(row.data, "deadLetteredAt"),
    parkedBuild: textOrNull(row.data, "parkedBuild"),
    resumeAttempts: intOf(row.data, "resumeAttempts"),
    resumeNotBefore: dateOrNull(row.data, "resumeNotBefore"),
    endedAt: dateOrNull(row.data, "endedAt"),
    startedAt: dateOrNull(row.data, "startedAt"),
    stepSeq: intOf(row.data, "stepSeq"),
    cancelledAt: dateOrNull(row.data, "cancelledAt"),
    cancelledBy: textOrNull(row.data, "cancelledBy"),
})

/** A step record read from the engine's row. */
export const stepRecordOf = (row: RecordRow): StepRecord => ({
    id: row.id,
    version: row.version,
    runId: textOf(row.data, "runId"),
    ordinal: intOf(row.data, "ordinal"),
    stepKey: textOf(row.data, "stepKey"),
    nodeKey: textOf(row.data, "nodeKey"),
    kind: textOf(row.data, "kind"),
    effect: effectOf(row.data),
    input: jsonOf(row.data, "input"),
    result: jsonOrNull(row.data, "result"),
    status: enumOf(row.data, "status", STEP_STATUSES),
    attempt: intOf(row.data, "attempt"),
    maxAttempts: intOf(row.data, "maxAttempts"),
    deadlineMs: intOf(row.data, "deadlineMs"),
    claimedUntil: dateOrNull(row.data, "claimedUntil"),
    notBefore: dateOrNull(row.data, "notBefore"),
    waitItemId: textOrNull(row.data, "waitItemId"),
    workItemId: textOrNull(row.data, "workItemId"),
    compAttempts: intOf(row.data, "compAttempts"),
    errorCode: textOrNull(row.data, "errorCode"),
})

/** A run as the engine and the trace read it. */
export const runViewOf = (run: RunRecord): RunView => ({
    id: run.id,
    workspaceId: run.workspaceId,
    agentId: run.agentId,
    wakeId: run.wakeId,
    trigger: run.trigger,
    versionId: run.graphVersionId,
    status: run.status,
    context: run.context,
    errorCode: run.errorCode,
    spoken: run.deadLetteredAt !== null,
})

/** A step as the trace and the sweep read it. */
export const stepViewOf = (step: StepRecord): RunStepView => ({
    stepKey: step.stepKey,
    nodeKey: step.nodeKey,
    kind: step.kind,
    seq: step.ordinal,
    status: step.status,
    effect: step.effect,
    attempt: step.attempt,
    errorCode: step.errorCode,
    result: step.result,
    waitItemId: step.waitItemId,
    fence: Number(step.version),
})

/** The part of a step the failure route reads. */
export const routeStepOf = (step: RunStepView): RouteStep => ({
    stepKey: step.stepKey,
    seq: step.seq,
    status: step.status,
    effect: step.effect,
})

/** One step of a run as a handler reads it: its own record, and the results of the steps done before it. */
export const handlerViewOf = (run: RunRecord, steps: ReadonlyArray<StepRecord>, step: StepRecord): StepView => ({
    stepKey: step.stepKey,
    nodeKey: step.nodeKey,
    kind: step.kind,
    effect: step.effect,
    input: step.input,
    maxAttempts: step.maxAttempts,
    deadlineMs: step.deadlineMs,
    runId: run.id,
    workspaceId: run.workspaceId,
    agentId: run.agentId,
    status: step.status,
    attempt: step.attempt,
    fence: Number(step.version),
    result: step.result,
    earlier: Object.fromEntries(
        steps.flatMap((earlier) =>
            earlier.status === "done" && earlier.ordinal < step.ordinal && earlier.result !== null
                ? [[earlier.stepKey, earlier.result] as const]
                : [],
        ),
    ),
})

/** Every step of a run as a handler reads it. */
export const handlerViewsOf = (run: RunRecord, steps: ReadonlyArray<StepRecord>): ReadonlyArray<StepView> =>
    steps.map((step) => handlerViewOf(run, steps, step))
