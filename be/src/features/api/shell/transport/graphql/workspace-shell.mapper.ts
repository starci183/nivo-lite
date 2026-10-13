import type { ShellFacts } from "@modules/domain/shell"
import type { GetShellRequest } from "../../application/get-shell.contracts"
import type { ShellWindowInput } from "./dto/shell-window.input"
import type { WorkspaceShellType } from "./dto/workspace-shell.type"

/** Maps the GraphQL window, with the workspace the request names, to the query request. */
export const toGetShellRequest = (workspaceId: string, input: ShellWindowInput): GetShellRequest => ({
    workspaceId,
    foundingFrom: input.foundingFrom,
    foundingTo: input.foundingTo,
})

/** Maps the shell facts to the GraphQL type. */
export const toWorkspaceShellType = (result: ShellFacts): WorkspaceShellType => ({
    leadCount: result.leadCount,
    openResponsibilityCount: result.openResponsibilityCount,
    agents: result.agents.map((agent) => ({ ...agent })),
    hasChatbot: result.hasChatbot,
    isFoundingMember: result.isFoundingMember,
    approvals: result.approvals.map((approval) => ({ ...approval })),
    exceptions: result.exceptions.map((exception) => ({ ...exception })),
    pendingDecisions: result.pendingDecisions,
})
