import { QueryHandler } from "@nestjs/cqrs"
import { toolLabelOf } from "@nivo-lite/blocks-core"
import { MODULE_DECLARATIONS } from "@nivo-lite/blocks-core/modules"
import { AgentDirectoryService } from "@modules/domain/agents"
import { DEFAULT_READ_TOOLS } from "@modules/domain/context-sources"
import { McpGatewayAdminService, PROVIDER_CATALOGUE } from "@modules/domain/mcp-gateway"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { agentToolsOf } from "./agent-tools.policy"
import type { AgentToolLine } from "./get-agent-tools.contracts"
import { GetAgentToolsQuery } from "./get-agent-tools.query"

@QueryHandler(GetAgentToolsQuery)
/**
 * Answers what one agent can really call: the tool set its module declares for its agent (a copied agent: the module of its
 * installation), the provider tools its ticked abilities add per attached account, and the default context reads, each with the
 * owner's restricting grant row. Owner or manager only (the rights board proves the role).
 */
export class GetAgentToolsHandler extends ICQRSHandler<GetAgentToolsQuery, ReadonlyArray<AgentToolLine>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
        private readonly agents: AgentDirectoryService,
        private readonly installations: InstallationRecordsService,
    ) {
        super(logger)
    }

    protected override async process(query: GetAgentToolsQuery): Promise<ReadonlyArray<AgentToolLine>> {
        const { workspaceId, agentId } = query.params.request
        const actor = { principalId: query.params.principal.id, workspaceId }
        const board = await this.admin.providerBoard(actor)
        const agent = await this.agents.find(workspaceId, agentId)
        if (agent === null) return []
        const [installation, grants] = await Promise.all([
            this.installations.ofAgent(workspaceId, agentId),
            this.admin.grants(actor),
        ])
        const moduleKey = installation?.moduleKey ?? agent.module
        return agentToolsOf({
            declared: MODULE_DECLARATIONS.find((module) => module.key === moduleKey)?.agent?.tools ?? [],
            defaultReads: DEFAULT_READ_TOOLS,
            attachments: board.attachments.filter((row) => row.agentId === agentId),
            accountLabels: new Map(
                board.providers.flatMap((provider) =>
                    provider.accounts.map((account) => [account.connectionId, account.label] as const),
                ),
            ),
            grants: grants.filter((grant) => grant.agentId === agentId),
            catalogue: PROVIDER_CATALOGUE,
            wordsOf: toolLabelOf,
        })
    }
}
