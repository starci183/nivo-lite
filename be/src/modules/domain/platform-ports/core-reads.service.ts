import { Injectable } from "@nestjs/common"
import type { CoreReads, CoreRun, CoreRunStep, CoreRunsQuery, CoreRunsPage } from "@nivo-lite/agent-sdk/platform"
import { AgentRunRecordsService, type StoredRun, type StoredStep } from "@modules/domain/agent-runs"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { InstallationRecordsService } from "@modules/domain/module-installations"

/** The most runs one page of the core read holds. */
const PAGE_MAX = 50

/** The most steps one read of a run holds. */
const STEPS_MAX = 100

/** A cursor of the core read: how many runs of the order the next page passes over. */
const CURSOR = /^p(\d{1,6})$/u

const skipOf = (after: string | undefined): number => {
    const found = after === undefined ? null : CURSOR.exec(after)
    return found?.[1] === undefined ? 0 : Number(found[1])
}

const runOf = (row: StoredRun): CoreRun => ({
    id: row.id,
    agentId: row.agentId,
    trigger: row.trigger,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    parkReason: row.parkReason,
    waitWorkItemId: row.waitWorkItemId,
})

const stepOf = (row: StoredStep): CoreRunStep => ({
    id: row.id,
    stepKey: row.stepKey,
    nodeKey: row.nodeKey,
    status: row.status,
    input: row.input,
    result: row.result,
    startedAt: row.startedAt,
    durationMs: row.durationMs,
    doorCalls: row.doorCalls,
    effectKey: row.effectKey,
    errorCode: row.errorCode,
    waitItemId: row.waitItemId,
})

@Injectable()
/**
 * The `platform.core` port: what a read of a module reads of the core of the engine, scoped to the workspace of the door run (the read's
 * own permission was proven by the door): the agent an installation runs (its installation record) and the runs of the agents with their
 * steps (the engine's core tables, through the runs' records service). A cursor is the count of runs passed over, so a forged one only
 * pages the same agent's runs of the same workspace.
 */
export class CoreReadsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly runs: AgentRunRecordsService,
        private readonly installations: InstallationRecordsService,
    ) {}

    /** The port for one workspace. */
    portFor(workspaceId: string): CoreReads {
        return {
            agentOf: async (installation) => (await this.installations.find(workspaceId, installation))?.agentId ?? null,
            runs: {
                list: (query) => this.page(workspaceId, query),
                get: async (runId) => {
                    const row = await this.engine.scoped(workspaceId, (tx) => this.runs.runRow(tx, runId))
                    return row === null ? null : runOf(row)
                },
                steps: async (runId, limit) => {
                    const rows = await this.engine.scoped(workspaceId, (tx) => this.runs.stepRowsOf(tx, runId))
                    return rows.slice(0, Math.min(limit, STEPS_MAX)).map((item) => stepOf(item))
                },
                count: async (agent, statuses) => {
                    const groups = await this.engine.scoped(workspaceId, (tx) =>
                        this.runs.runCounts(tx, { agentId: agent, ...(statuses === undefined ? {} : { statuses }) }),
                    )
                    return groups.map((group) => ({ status: group.status, count: group.count }))
                },
            },
        }
    }

    private async page(workspaceId: string, query: CoreRunsQuery): Promise<CoreRunsPage> {
        const size = Math.max(1, Math.min(query.size, PAGE_MAX))
        const skip = skipOf(query.after)
        const rows = await this.engine.scoped(workspaceId, (tx) =>
            this.runs.runRows(
                tx,
                {
                    agentId: query.agent,
                    ...(query.statuses === undefined ? {} : { statuses: query.statuses }),
                    order: query.order,
                    skip,
                },
                size + 1,
            ),
        )
        return {
            rows: rows.slice(0, size).map((item) => runOf(item)),
            next: rows.length > size ? `p${String(skip + size)}` : null,
        }
    }
}
