import type { WorkspaceDashboardData } from "@modules/domain/workspace-dashboard"
import type { GetWorkspaceDashboardRequest } from "../../application/get-workspace-dashboard.contracts"
import type { WorkspaceDashboardInput } from "./dto/workspace-dashboard.input"
import type { WorkspaceDashboardType } from "./dto/workspace-dashboard.type"

/** Selects the workspace from the header and the period from the input. */
export const toWorkspaceDashboardRequest = (
    workspaceId: string,
    input: WorkspaceDashboardInput,
): GetWorkspaceDashboardRequest => ({ workspaceId, period: input.period })

/** Maps the domain figures to the public GraphQL fields; the window becomes ISO text. */
export const toWorkspaceDashboardType = (data: WorkspaceDashboardData): WorkspaceDashboardType => ({
    period: data.window.period,
    from: data.window.from.toISOString(),
    to: data.window.to.toISOString(),
    conversations: data.conversations,
    newContacts: data.newContacts,
    runsDone: data.runsDone,
    runsFailed: data.runsFailed,
    agentAutoRate: data.agentAutoRate,
    approvals: { total: data.approvals.total, items: data.approvals.items.map((item) => ({ ...item })) },
    savings: { ...data.savings, lines: data.savings.lines.map((line) => ({ ...line })) },
    agents: data.agents.map((agent) => ({ ...agent })),
})
