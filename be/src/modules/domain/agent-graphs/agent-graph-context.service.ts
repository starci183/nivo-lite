import { Injectable } from "@nestjs/common"
import { ToolRegistryService } from "@modules/domain/tools"
import type { GraphContext } from "./agent-graphs.contracts"
import { GraphFactsService } from "./graph-facts.service"

/** The agent the context is built for. */
export interface ContextScope {
    /** The workspace id. */
    readonly workspaceId: string
    /** The agent id. */
    readonly agentId: string
    /** The installation id. */
    readonly installationId: string
    /** The module key. */
    readonly moduleKey: string
}

/**
 * The wildcard grants that would cover a full tool name, one per prefix of it (`nivo.tool.brain.search` → `nivo.tool.*`,
 * `nivo.tool.brain.*`; `nivo.tool.payment.credit.list` → `nivo.tool.*`, `nivo.tool.payment.*`, `nivo.tool.payment.credit.*`); a bare
 * `nivo.*` covers nothing.
 */
const wildcardsOf = (tool: string): ReadonlyArray<string> => {
    const parts = tool.split(".")
    return parts
        .slice(0, -1)
        .map((_, index) => `${parts.slice(0, index + 1).join(".")}.*`)
        .filter((wildcard) => wildcard !== "nivo.*")
}

@Injectable()
/**
 * What the pure checks of a graph need to know about the workspace, read once per check: the facts the modules declare, and the tools the
 * agent holds a grant on. No authority rule caps a branch, no approver's grant is checked and no intent
 * frame is looked up: the rules decide nothing since the engine gate was removed (2026-11-13).
 */
export class AgentGraphContextService {
    constructor(
        private readonly facts: GraphFactsService,
        private readonly gateway: ToolRegistryService,
    ) {}

    /** The context of one agent for a graph about to be checked. */
    async contextOf(scope: ContextScope): Promise<GraphContext> {
        const grants = await this.gateway.grantsOf(scope.workspaceId, scope.agentId)
        const granted = new Set(grants.map((grant) => grant.tool))
        return {
            facts: this.facts.registry(),
            isGranted: (tool) => granted.has(tool) || wildcardsOf(tool).some((wildcard) => granted.has(wildcard)),
        }
    }
}
