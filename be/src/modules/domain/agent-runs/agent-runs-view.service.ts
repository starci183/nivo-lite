import { Injectable } from "@nestjs/common"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { isRecord } from "@modules/platform/primitives"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { runEngineOf, runRecordOf, stepRecordOf } from "./agent-runs.mapper"
import type { OptionalRunDetail, RunListEntry, RunStepCall, RunStepDetail } from "./agent-runs-view.contracts"
import type { RunWorkItem, StoredStep } from "./agent-runs-rows.contracts"

/** The most runs the list of an agent holds. */
export const RUNS_LISTED = 50

const dateOf = (value: string | null): Date | null => (value === null ? null : new Date(value))

/** The door calls a step recorded, in order; none where it recorded none. */
const callsOf = (value: unknown): ReadonlyArray<RunStepCall> => {
    const calls = isRecord(value) ? value.calls : null
    if (!Array.isArray(calls)) return []
    return calls.flatMap((call: unknown): ReadonlyArray<RunStepCall> => {
        if (!isRecord(call) || typeof call.tool !== "string" || typeof call.ok !== "boolean") return []
        return [{ tool: call.tool, ok: call.ok, failure: typeof call.failure === "string" ? call.failure : null }]
    })
}

/** One step row as the run page reads it. */
export const stepDetailOf = (row: StoredStep): RunStepDetail => {
    const step = stepRecordOf(row)
    return {
        stepKey: step.stepKey,
        nodeKey: step.nodeKey,
        kind: step.kind,
        ordinal: step.ordinal,
        status: step.status,
        attempt: step.attempt,
        maxAttempts: step.maxAttempts,
        startedAt: dateOf(row.startedAt),
        endedAt: dateOf(row.endedAt),
        durationMs: row.durationMs,
        errorCode: step.errorCode,
        waitItemId: step.waitItemId,
        workItemId: step.workItemId,
        input: step.input,
        result: step.result,
        calls: callsOf(row.doorCalls),
    }
}

/** The first work item of each run. */
const firstItemsOf = (rows: ReadonlyArray<RunWorkItem>): ReadonlyMap<string, string> => {
    const items = new Map<string, string>()
    for (const row of rows) if (!items.has(row.runId)) items.set(row.runId, row.workItemId)
    return items
}

@Injectable()
/**
 * The read side of the runs of one agent for its Work tab: the newest runs with how far each has come, and one run with its steps, their
 * moments, tries, door calls and errors. It reads and changes nothing, and it reads only the runs of the agent it is asked about.
 */
export class AgentRunsViewService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly records: AgentRunRecordsService,
    ) {}

    /** The newest runs of the agent, newest first, each with the progress of its steps. */
    list(workspaceId: string, agentId: string): Promise<ReadonlyArray<RunListEntry>> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const runs = await this.records.runsOfAgent(tx, agentId, RUNS_LISTED)
            const ids = runs.map((run) => run.id)
            const [counts, linked] = await Promise.all([
                this.records.stepCountsOf(tx, ids),
                this.records.workItemsOf(tx, ids),
            ])
            const items = firstItemsOf(linked)
            return runs.map((run): RunListEntry => {
                const measures = counts.find((row) => row.runId === run.id)
                return {
                    run,
                    stepTotal: measures?.total ?? 0,
                    stepDone: measures?.done ?? 0,
                    stepBegun: measures?.begun ?? 0,
                    stepFailed: measures?.failed ?? 0,
                    workItemId: items.get(run.id) ?? null,
                }
            })
        })
    }

    /** One run of the agent with its steps in order and the engine it is on, or null when the agent has no such run. */
    detail(workspaceId: string, agentId: string, runId: string): Promise<OptionalRunDetail> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const row = await this.records.runRow(tx, runId)
            if (row === null) return null
            const run = runRecordOf(row)
            if (run.agentId !== agentId) return null
            const rows = await this.records.stepRowsOf(tx, runId)
            return { run, engine: runEngineOf(row), steps: rows.map((step) => stepDetailOf(step)) }
        })
    }
}
