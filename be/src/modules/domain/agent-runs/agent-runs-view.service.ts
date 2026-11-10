import { Injectable } from "@nestjs/common"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { isRecord } from "@modules/platform/primitives"
import type { AggregateRow, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { runEngineOf, runRecordOf, stepRecordOf } from "./agent-runs.mapper"
import type { OptionalRunDetail, RunListEntry, RunStepCall, RunStepDetail } from "./agent-runs-view.contracts"

/** The entity of a run, read whole for one run's page. */
const RUN = "agent.run"

/** The most runs the list of an agent holds. */
export const RUNS_LISTED = 50

const numberOf = (value: unknown): number => (typeof value === "number" ? value : Number(value ?? 0))

const dateOf = (value: unknown): Date | null => (typeof value === "string" ? new Date(value) : null)

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
export const stepDetailOf = (row: RecordRow): RunStepDetail => {
    const step = stepRecordOf(row)
    const durationMs = row.data.durationMs
    return {
        stepKey: step.stepKey,
        nodeKey: step.nodeKey,
        kind: step.kind,
        ordinal: step.ordinal,
        status: step.status,
        attempt: step.attempt,
        maxAttempts: step.maxAttempts,
        startedAt: dateOf(row.data.startedAt),
        endedAt: dateOf(row.data.endedAt),
        durationMs: typeof durationMs === "number" ? durationMs : null,
        errorCode: step.errorCode,
        waitItemId: step.waitItemId,
        workItemId: step.workItemId,
        input: step.input,
        result: step.result,
        calls: callsOf(row.data.doorCalls),
    }
}

/** The first work item of each run, from the groups of the aggregate that names them. */
const firstItemsOf = (rows: ReadonlyArray<AggregateRow>): ReadonlyMap<string, string> => {
    const items = new Map<string, string>()
    for (const row of rows) {
        const run = row.groups.runId
        const item = row.groups.workItemId
        if (run != null && item != null && !items.has(run)) items.set(run, item)
    }
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
                const measures = counts.find((row) => row.groups.runId === run.id)?.measures ?? {}
                return {
                    run,
                    stepTotal: numberOf(measures.total),
                    stepDone: numberOf(measures.done),
                    stepBegun: numberOf(measures.begun),
                    stepFailed: numberOf(measures.failed),
                    workItemId: items.get(run.id) ?? null,
                }
            })
        })
    }

    /** One run of the agent with its steps in order and the engine it is on, or null when the agent has no such run. */
    detail(workspaceId: string, agentId: string, runId: string): Promise<OptionalRunDetail> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const row = await this.engine.get(tx, RUN, runId)
            if (row === null) return null
            const run = runRecordOf(row)
            if (run.agentId !== agentId) return null
            const rows = await this.records.stepRowsOf(tx, runId)
            return { run, engine: runEngineOf(row), steps: rows.map((step) => stepDetailOf(step)) }
        })
    }
}
