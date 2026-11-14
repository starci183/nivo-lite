import { Injectable } from "@nestjs/common"
import type { CoreReads, CoreRun, CoreRunStep, CoreRunsQuery, CoreRunsPage } from "@nivo-lite/agent-sdk/platform"
import {
    AgentRunRecordsService,
    WAIT_PARKED_STATUS,
    reportedStatusOf,
    type StoredRun,
    type StoredStep,
} from "@modules/domain/agent-runs"
import { EntityEngineService, type ScopedTx } from "@modules/domain/entity-engine"
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

/** The stored status of a run in flight; with a wait mark it is reported `waiting`. */
const RUNNING = "running"

/** A run as the core read reports it: its status is the REPORTED one (`reportedStatusOf`: parked at a `wait` reads `waiting`). */
const runOf = (row: StoredRun, waitMarked: ReadonlySet<string>): CoreRun => ({
    id: row.id,
    agentId: row.agentId,
    trigger: row.trigger,
    status: reportedStatusOf(row.status, waitMarked.has(row.id)),
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
 * steps (the engine's core tables, through the runs' records service). A run is reported in its REPORTED status (`reportedStatusOf`:
 * a run parked at a `wait`, stored `running` with its wait mark, reads `waiting`), and listed, filtered and counted so. A cursor is the
 * count of runs passed over, so a forged one only pages the same agent's runs of the same workspace.
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
                get: (runId) =>
                    this.engine.scoped(workspaceId, async (tx) => {
                        const row = await this.runs.runRow(tx, runId)
                        return row === null ? null : runOf(row, await this.waitMarkedOf(tx, [row]))
                    }),
                steps: async (runId, limit) => {
                    const rows = await this.engine.scoped(workspaceId, (tx) => this.runs.stepRowsOf(tx, runId))
                    return rows.slice(0, Math.min(limit, STEPS_MAX)).map((item) => stepOf(item))
                },
                count: async (agent, statuses) => {
                    const { groups, parked } = await this.engine.scoped(workspaceId, async (tx) => ({
                        groups: await this.runs.runCounts(tx, { agentId: agent }),
                        parked: await this.runs.runCounts(tx, { agentId: agent, statuses: [RUNNING], waitMarked: true }),
                    }))
                    // A run parked at a `wait` is counted `waiting` (its stored `running` less those), as every row of it is reported.
                    const atWait = parked.reduce((sum, group) => sum + group.count, 0)
                    const reported = new Map<string, number>()
                    for (const group of groups) reported.set(group.status, (reported.get(group.status) ?? 0) + group.count)
                    if (atWait > 0) {
                        reported.set(RUNNING, (reported.get(RUNNING) ?? 0) - atWait)
                        reported.set(WAIT_PARKED_STATUS, (reported.get(WAIT_PARKED_STATUS) ?? 0) + atWait)
                    }
                    return [...reported]
                        .filter(([status, count]) => count > 0 && (statuses === undefined || statuses.includes(status)))
                        .map(([status, count]) => ({ status, count }))
                },
            },
        }
    }

    /** The ids of the runs among `rows` stored `running` that carry a wait mark (parked at a `wait`): one read of the page's ids. */
    private async waitMarkedOf(tx: ScopedTx, rows: ReadonlyArray<StoredRun>): Promise<ReadonlySet<string>> {
        const ids = rows.filter((row) => row.status === RUNNING).map((row) => row.id)
        if (ids.length === 0) return new Set()
        const marked = await this.runs.runRows(tx, { ids, statuses: [RUNNING], waitMarked: true, order: "started" }, ids.length)
        return new Set(marked.map((row) => row.id))
    }

    /** One page of the agent's runs, narrowed by REPORTED status (a run parked at a `wait` is listed under `waiting`, never `running`). */
    private async page(workspaceId: string, query: CoreRunsQuery): Promise<CoreRunsPage> {
        const size = Math.max(1, Math.min(query.size, PAGE_MAX))
        const skip = skipOf(query.after)
        return this.engine.scoped(workspaceId, async (tx) => {
            const rows = await this.runs.runRows(
                tx,
                {
                    agentId: query.agent,
                    ...(query.statuses === undefined ? {} : { reported: query.statuses }),
                    order: query.order,
                    skip,
                },
                size + 1,
            )
            const shown = rows.slice(0, size)
            const marked = await this.waitMarkedOf(tx, shown)
            return {
                rows: shown.map((item) => runOf(item, marked)),
                next: rows.length > size ? `p${String(skip + size)}` : null,
            }
        })
    }
}
