import { Injectable } from "@nestjs/common"
import { AgentRunRecordsService, type RunCount } from "@modules/domain/agent-runs"
import { EntityEngineService, type ScopedTx } from "@modules/domain/entity-engine"
import { ContactsService } from "@modules/domain/contacts"
import { ChannelDeliveriesService } from "@modules/domain/customer-routes"
import type { Compared, DashboardWindow, RecordsFacts } from "./workspace-dashboard.contracts"

/** The statuses of a run that finished. */
const DONE_RUN_STATUSES = ["done", "compensated"] as const

/** The statuses of a run that failed or was handed to a person. */
const FAILED_RUN_STATUSES = ["failed", "dead"] as const

/** The failed statuses, read as any status text may be asked about. */
const FAILED_RUN_WORDS: ReadonlyArray<string> = FAILED_RUN_STATUSES

const sum = (rows: ReadonlyArray<RunCount>, of: ReadonlyArray<string>): number =>
    rows.filter((row) => of.includes(row.status)).reduce((total, row) => total + row.count, 0)

@Injectable()
/**
 * What the engine's own data says about a period, read from the engine's own tables and no module's records: new contacts (the people
 * created in the period, `contacts`), messages answered (the delivered rows of the delivery ledger taken in the period,
 * `channel_deliveries`), conversations (the distinct ROUTES the shop answered on in the period: a route keeps no last activity, so
 * this is the routes with a delivered message, not every route a customer wrote on) and agent runs (the core runs table, counted per
 * agent and status for the period and the one before it, in one workspace scope). Nothing of a module (orders, payments, leads) is read
 * here, and nothing loops per row.
 */
export class DashboardRecordsReadService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly runRows: AgentRunRecordsService,
        private readonly contacts: ContactsService,
        private readonly deliveries: ChannelDeliveriesService,
    ) {}

    /** Reads every figure of the window: contacts and deliveries from the engine's stores, the runs in one workspace scope. */
    async read(workspaceId: string, window: DashboardWindow): Promise<RecordsFacts> {
        const [conversations, newContacts, answered] = await Promise.all([
            this.comparedOf((from, to) => this.deliveries.routesTold(workspaceId, from, to), window),
            this.comparedOf((from, to) => this.contacts.countCreated(workspaceId, from, to), window),
            this.deliveries.countDelivered(workspaceId, window.from, window.to),
        ])
        return this.engine.scoped(workspaceId, async (tx) => {
            const runs = await this.runs(tx, window)
            return {
                conversations,
                newContacts,
                runsDone: runs.done,
                runsFailed: runs.failed,
                messagesAnswered: answered,
                failedRunsByAgent: runs.failedByAgent,
            }
        })
    }

    /** A figure in the period and in the one before it, each read by the same count over its own `[from, to)`. */
    private async comparedOf(count: (from: Date, to: Date) => Promise<number>, window: DashboardWindow): Promise<Compared> {
        const [current, previous] = await Promise.all([count(window.from, window.to), count(window.previousFrom, window.from)])
        return { current, previous }
    }

    /** Runs finished and runs failed in the period and before it; the failed ones of the period also per agent. */
    private async runs(
        tx: ScopedTx,
        window: DashboardWindow,
    ): Promise<{ done: Compared; failed: Compared; failedByAgent: ReadonlyMap<string, number> }> {
        const statuses = [...DONE_RUN_STATUSES, ...FAILED_RUN_STATUSES]
        const [now, before] = await Promise.all([
            this.runRows.runCounts(tx, {
                statuses,
                started: { from: window.from.toISOString(), to: window.to.toISOString() },
            }),
            this.runRows.runCounts(tx, {
                statuses,
                started: { from: window.previousFrom.toISOString(), to: window.from.toISOString() },
            }),
        ])
        const failedByAgent = new Map<string, number>()
        for (const row of now) {
            if (row.count > 0 && FAILED_RUN_WORDS.includes(row.status))
                failedByAgent.set(row.agentId, (failedByAgent.get(row.agentId) ?? 0) + row.count)
        }
        return {
            done: { current: sum(now, DONE_RUN_STATUSES), previous: sum(before, DONE_RUN_STATUSES) },
            failed: { current: sum(now, FAILED_RUN_STATUSES), previous: sum(before, FAILED_RUN_STATUSES) },
            failedByAgent,
        }
    }
}
