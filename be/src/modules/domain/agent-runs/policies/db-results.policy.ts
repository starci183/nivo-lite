import { isRecord } from "@modules/platform/primitives"
import type { AgentStepStatus, StepEffect, StepJson, StepView } from "../agent-runs.contracts"
import type { ClaimResult, CommitResult, CompensationClaim, CompensationCommit, RunDue } from "../agent-runs-engine.contracts"

const STEP_STATUSES: ReadonlySet<string> = new Set(["pending", "running", "done", "failed", "compensating", "compensated"])

const isStepStatus = (value: unknown): value is AgentStepStatus =>
    typeof value === "string" && STEP_STATUSES.has(value)

const jsonOf = (value: unknown): StepJson | null => (isRecord(value) ? value : null)

/** Reads the effect of a step: a read, a compensable naming its compensation, or a pivot. */
export const parseEffect = (value: unknown): StepEffect | null => {
    if (!isRecord(value)) return null
    if (value.kind === "read") return { kind: "read" }
    if (value.kind === "pivot") return { kind: "pivot" }
    if (value.kind === "compensable" && typeof value.compensation === "string") {
        return { kind: "compensable", compensation: value.compensation }
    }
    return null
}

const resultsOf = (value: unknown): Readonly<Record<string, StepJson>> => {
    if (!isRecord(value)) return {}
    const entries = Object.entries(value).flatMap(([key, result]) => {
        const json = jsonOf(result)
        return json === null ? [] : [[key, json] as const]
    })
    return Object.fromEntries(entries)
}

/** Reads one step as a database function answers it, or null when it is not one. */
export const parseStep = (value: unknown): StepView | null => {
    if (!isRecord(value)) return null
    const effect = parseEffect(value.effect)
    const input = jsonOf(value.input)
    const result = value.result === null || value.result === undefined ? null : jsonOf(value.result)
    if (
        effect === null ||
        input === null ||
        !isStepStatus(value.status) ||
        typeof value.stepId !== "string" ||
        typeof value.runId !== "string" ||
        typeof value.workspaceId !== "string" ||
        typeof value.agentId !== "string" ||
        typeof value.stepKey !== "string" ||
        typeof value.nodeKey !== "string" ||
        typeof value.kind !== "string" ||
        typeof value.attempt !== "number" ||
        typeof value.maxAttempts !== "number" ||
        typeof value.deadlineMs !== "number" ||
        typeof value.fence !== "number"
    ) {
        return null
    }
    return {
        stepKey: value.stepKey,
        nodeKey: value.nodeKey,
        kind: value.kind,
        effect,
        input,
        maxAttempts: value.maxAttempts,
        deadlineMs: value.deadlineMs,
        runId: value.runId,
        workspaceId: value.workspaceId,
        agentId: value.agentId,
        status: value.status,
        attempt: value.attempt,
        fence: value.fence,
        result,
        earlier: resultsOf(value.earlier),
    }
}

const WITH_STEP: ReadonlySet<string> = new Set(["claimed", "exhausted", "waiting_expired"])

/** Reads the answer of `agent_step_claim`, or null when it is not one the engine knows. */
export const parseClaim = (value: unknown): ClaimResult | null => {
    if (!isRecord(value) || typeof value.result !== "string") return null
    const { result } = value
    if (result === "done") return { kind: "done", answer: jsonOf(value.answer) }
    if (result === "later") {
        return typeof value.retryAfterMs === "number" ? { kind: "later", retryAfterMs: value.retryAfterMs } : null
    }
    if (WITH_STEP.has(result)) {
        const step = parseStep(value.step)
        if (step === null) return null
        if (result === "claimed") return { kind: "claimed", step }
        return result === "exhausted" ? { kind: "exhausted", step } : { kind: "waiting_expired", step }
    }
    if (result === "busy" || result === "closed" || result === "idle" || result === "gone") return { kind: result }
    return null
}

/** Reads the answer of `agent_comp_claim`, or null. */
export const parseCompensationClaim = (value: unknown): CompensationClaim | null => {
    if (!isRecord(value)) return null
    if (value.result === "claimed") {
        const step = parseStep(value.step)
        return step === null ? null : { kind: "claimed", step }
    }
    if (value.result === "busy" || value.result === "closed" || value.result === "finished") {
        return { kind: value.result }
    }
    return null
}

/** Reads the text a commit function answers, or null. */
export const parseCommit = (value: unknown): CommitResult | null =>
    value === "ok" || value === "fenced" ? value : null

/** Reads the text a compensation commit answers, or null. */
export const parseCompensationCommit = (value: unknown): CompensationCommit | null =>
    value === "ok" || value === "fenced" || value === "dead" ? value : null

const DUE_KINDS: ReadonlyArray<RunDue["kind"]> = ["expired", "ready", "compensating", "unspoken"]

const dueKindOf = (value: unknown): RunDue["kind"] | null => DUE_KINDS.find((kind) => kind === value) ?? null

const dueOf = (row: unknown): RunDue | null => {
    if (!isRecord(row)) return null
    const kind = dueKindOf(row.due_kind)
    if (
        kind === null ||
        typeof row.due_run !== "string" ||
        typeof row.due_workspace !== "string" ||
        typeof row.due_agent !== "string" ||
        typeof row.due_step !== "string" ||
        !(row.due_at instanceof Date || typeof row.due_at === "string")
    ) {
        return null
    }
    const at = new Date(row.due_at)
    return {
        kind,
        runId: row.due_run,
        workspaceId: row.due_workspace,
        agentId: row.due_agent,
        stepKey: row.due_step,
        fence: Number(row.due_fence),
        at,
    }
}

/** Reads the rows of `agent_run_due`, or null when one is not a row the sweep knows. */
export const parseDue = (rows: unknown): ReadonlyArray<RunDue> | null => {
    if (!Array.isArray(rows)) return null
    const found = rows.flatMap((row) => {
        const item = dueOf(row)
        return item === null ? [] : [item]
    })
    return found.length === rows.length ? found : null
}
