import { isRecord } from "@modules/platform/primitives"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import type { AgentRunStatus, AgentStepStatus, StepEffect, StepJson } from "./agent-runs.contracts"
import type { RunView } from "./agent-runs-engine.contracts"
import type { RunRecord, StepRecord } from "./agent-runs-records.contracts"
import type { RunEngine } from "./agent-runs-view.contracts"
import { DEFAULT_DEADLINE_MS } from "./policies/agent-runs.policy"

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

const RUN_ENGINES: ReadonlyArray<RunEngine> = ["legacy", "langgraph"]

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

/**
 * How long one try of the step may run. A row that names none (a thread's step row, which the projection writes with the deadline its
 * spec named, often none; every such row on dev before FX1) reads the default every step is filled with at append (`filled`), never a
 * refusal: the run page, the thread runs' engine read and the stop door read step rows through here,
 * and one unreadable row made a crashed thread's wake and the sweep fail for ever (D-P10-6). A value that is no number is still refused.
 */
const deadlineOf = (data: Data): number => {
    const value = data.deadlineMs
    return value === null || value === undefined ? DEFAULT_DEADLINE_MS : intOf(data, "deadlineMs")
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
    engine: runEngineOf(row),
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

/** The engine a run is on: `legacy` for a row that names none (every run opened before the field existed), else the one it names. */
export const runEngineOf = (row: RecordRow): RunEngine =>
    row.data.engine === null || row.data.engine === undefined ? "legacy" : enumOf(row.data, "engine", RUN_ENGINES)

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
    deadlineMs: deadlineOf(row.data),
    claimedUntil: dateOrNull(row.data, "claimedUntil"),
    notBefore: dateOrNull(row.data, "notBefore"),
    waitItemId: textOrNull(row.data, "waitItemId"),
    workItemId: textOrNull(row.data, "workItemId"),
    compAttempts: intOf(row.data, "compAttempts"),
    errorCode: textOrNull(row.data, "errorCode"),
})

/** A run as its readers read it. */
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
