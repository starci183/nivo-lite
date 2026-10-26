import type { AgentKnowledgeLens } from "@modules/domain/agents"
import type { AgentKnowledgeLensesRequest } from "../../application/agent-knowledge-lenses.contracts"
import type { AgentKnowledgeLensType } from "./dto/agent-knowledge-lens.type"

/** Maps the workspace of the call to the request. */
export const toAgentKnowledgeLensesRequest = (workspaceId: string): AgentKnowledgeLensesRequest => ({ workspaceId })

/** Maps the views to the GraphQL types. */
export const toAgentKnowledgeLensesType = (result: ReadonlyArray<AgentKnowledgeLens>): Array<AgentKnowledgeLensType> =>
    result.map((lens) => ({
        kind: lens.kind,
        agentId: lens.agentId,
        installationId: lens.installationId,
        module: lens.module,
        name: lens.name,
        avatarUrl: lens.avatarUrl,
        audience: lens.audience,
        lanes: lens.cells.map((cell) => ({ lane: cell.lane, open: cell.isOpen, count: cell.count })),
    }))
