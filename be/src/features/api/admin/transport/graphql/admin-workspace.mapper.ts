import type {
    GetWorkspaceDetailRequest,
    GetWorkspaceDetailResult,
} from "../../application/get-workspace-detail.contracts"
import type { AdminWorkspaceInput } from "./dto/admin-workspace.input"
import type { AdminWorkspaceDetailType } from "./dto/admin-workspace-detail.type"

/** Maps the GraphQL input to the application request. */
export const toAdminWorkspaceRequest = (input: AdminWorkspaceInput): GetWorkspaceDetailRequest => ({
    workspaceId: input.workspaceId,
})

/** Maps the application result to the GraphQL type. */
export const toAdminWorkspaceDetailType = (result: GetWorkspaceDetailResult): AdminWorkspaceDetailType => ({
    workspace: { ...result.workspace },
    credits: { ...result.credits },
    members: result.members.map((entry) => ({ ...entry })),
    invites: result.invites.map((entry) => ({ ...entry })),
    orders: result.orders.map((entry) => ({ ...entry })),
    transfers: result.transfers.map((entry) => ({ ...entry })),
    billingEvents: result.billingEvents.map((entry) => ({ ...entry })),
    modules: result.modules.map((entry) => ({ ...entry })),
    connections: result.connections.map((entry) => ({ ...entry })),
    errors: result.errors.map((entry) => ({ ...entry })),
    knowledgeTotal: result.knowledgeTotal,
    knowledge: result.knowledge.map((entry) => ({
        kind: entry.kind,
        byStatus: entry.byStatus.map((count) => ({ ...count })),
    })),
    activity: { ...result.activity },
})
