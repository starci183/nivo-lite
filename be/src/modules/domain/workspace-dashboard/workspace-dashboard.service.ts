import { Injectable } from "@nestjs/common"
import { AgentsService } from "@modules/domain/agents"
import { AiUsageEventsService, creditsUsedShown } from "@modules/domain/ai-usage-events"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsDashboardReadService, type DashboardRange } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { DashboardRecordsReadService } from "./dashboard-records-read.service"
import { agentRowsOf, approvalRowOf, autoRatesOf, type AgentDirectory } from "./policies/dashboard-agents.policy"
import { windowOf } from "./policies/dashboard-period.policy"
import { DEFAULT_MINUTES, minutesSavedBy, savingLinesOf } from "./policies/saved-minutes.policy"
import type { DashboardPeriod, WorkspaceDashboardData } from "./workspace-dashboard.contracts"

/** Only the people who answer for the business read its dashboard. */
const READERS = ["owner", "manager"] as const

/** How many waiting items the dashboard lists (the count says how many wait in all). */
const APPROVALS_LISTED = 6

@Injectable()
/**
 * The owner's dashboard of the engine's own figures: conversations, new contacts and runs from the records, and what the agents did
 * from the work items and the usage ledger. No module's records (orders, payments, leads) are read here. One call computes the whole page; every read is an aggregate statement over the
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
        private readonly zones: WorkspaceTimeZoneService,
    ) {}

    /** The dashboard of a workspace for a period, for an active owner or manager. */
    async read(userId: string, workspaceId: string, period: DashboardPeriod): Promise<WorkspaceDashboardData> {
        await this.members.require(userId, workspaceId, READERS)
        const window = windowOf(period, this.clock.now(), await this.zones.timeZoneOf(workspaceId))
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
            conversations: facts.conversations,
            newContacts: facts.newContacts,
            runsDone: facts.runsDone,
            runsFailed: facts.runsFailed,
            agentAutoRate: autoRatesOf(activity),
            approvals: {
                total: approvals.total,
                items: approvals.items.map((item) => approvalRowOf(directory, item)),
            },
            savings: {
                minutesSaved: minutesSavedBy(finished),
                lines: savingLinesOf(finished),
                defaultMinutes: DEFAULT_MINUTES,
                messagesAnswered: facts.messagesAnswered,
                creditsUsed: creditsUsedShown(quota?.creditsUsed ?? 0),
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
