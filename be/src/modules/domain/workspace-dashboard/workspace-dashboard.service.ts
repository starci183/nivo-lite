import { Injectable } from "@nestjs/common"
import { AgentsService } from "@modules/domain/agents"
import { AiUsageEventsService } from "@modules/domain/ai-usage-events"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsDashboardReadService } from "@modules/domain/work-items"
import type { DashboardRange } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { DashboardRecordsReadService } from "./dashboard-records-read.service"
import { agentRowsOf, approvalRowOf, autoRatesOf } from "./policies/dashboard-agents.policy"
import type { AgentDirectory } from "./policies/dashboard-agents.policy"
import { rateOf } from "./policies/dashboard-facts.policy"
import { windowOf } from "./policies/dashboard-period.policy"
import { DEFAULT_MINUTES, minutesSavedBy, savingLinesOf } from "./policies/saved-minutes.policy"
import type { DashboardPeriod, WorkspaceDashboardData } from "./workspace-dashboard.contracts"

/** Only the people who answer for the business read its takings. */
const READERS = ["owner", "manager"] as const

/** How many waiting items the dashboard lists (the count says how many wait in all). */
const APPROVALS_LISTED = 6

@Injectable()
/**
 * The owner's business dashboard: takings, orders, customers, the sales funnel and channels from the records, and what the agents did
 * from the work items and the usage ledger. One call computes the whole page; every read is an aggregate statement over the
 * workspace (a handful in all, none per row), run side by side.
 */
export class WorkspaceDashboardService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly records: DashboardRecordsReadService,
        private readonly items: WorkItemsDashboardReadService,
        private readonly usage: AiUsageEventsService,
        private readonly agents: AgentsService,
        private readonly installations: InstallationRecordsService,
    ) {}

    /** The dashboard of a workspace for a period, for an active owner or manager. */
    async read(userId: string, workspaceId: string, period: DashboardPeriod): Promise<WorkspaceDashboardData> {
        await this.members.require(userId, workspaceId, READERS)
        const window = windowOf(period, this.clock.now())
        const range: DashboardRange = { from: window.from, to: window.to, previousFrom: window.previousFrom }
        const [facts, activity, responses, waiting, approvals, credits, quota, agents, installations] =
            await Promise.all([
                this.records.read(workspaceId, window),
                this.items.activityOf(workspaceId, range),
                this.items.responseTimesOf(workspaceId, range),
                this.items.waitingOf(workspaceId),
                this.items.waitingApprovalsOf(workspaceId, APPROVALS_LISTED),
                this.usage.creditsByModule(workspaceId, window.from, window.to),
                this.usage.readQuotaStatus(workspaceId),
                this.agents.list(userId, workspaceId),
                this.installations.list(workspaceId),
            ])
        const directory: AgentDirectory = {
            agents: agents.map((agent) => ({
                id: agent.id,
                module: agent.module,
                name: agent.name,
                handle: agent.handle,
            })),
            installations: installations.map((installation) => ({
                id: installation.id,
                agentId: installation.agentId,
            })),
        }
        const finished = activity.map((row) => ({ action: row.action, count: row.done }))
        return {
            window,
            revenue: facts.revenueVnd,
            orders: facts.ordersPlaced,
            newCustomers: facts.leads,
            closeRate: {
                current: rateOf(facts.ordersPaid.current, facts.leads.current),
                previous: rateOf(facts.ordersPaid.previous, facts.leads.previous),
            },
            agentAutoRate: autoRatesOf(activity),
            days: facts.days,
            funnel: {
                visitors: facts.leads.current,
                consulted: facts.leadsConsulted.current,
                ordered: facts.ordersPlaced.current,
                paid: facts.ordersPaid.current,
            },
            channels: facts.channels,
            approvals: {
                total: approvals.total,
                items: approvals.items.map((item) => approvalRowOf(directory, item)),
            },
            savings: {
                minutesSaved: minutesSavedBy(finished),
                lines: savingLinesOf(finished),
                defaultMinutes: DEFAULT_MINUTES,
                messagesAnswered: facts.messagesAnswered,
                ordersCreated: facts.ordersPlaced.current,
                paymentsMatched: facts.matchedPayments,
                creditsUsed: quota?.creditsUsed ?? 0,
                creditsLimit: quota?.creditsLimit ?? null,
            },
            agents: agentRowsOf({
                directory,
                activity,
                responses,
                waiting,
                creditsByModule: credits,
                failedRunsByAgent: facts.failedRunsByAgent,
            }),
        }
    }
}
