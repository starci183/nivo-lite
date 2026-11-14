import { Injectable } from "@nestjs/common"
import { DEFAULT_READ_TOOLS } from "@modules/domain/context-sources"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { AgentDirectoryService } from "@modules/domain/agents"
import { PROVIDER_CATALOGUE, ToolsConsoleService } from "@modules/domain/tools"
import type { AgentToolLine } from "./agent-tool-lines.contracts"
import { agentToolsOf } from "./agent-tool-lines.policy"

@Injectable()
/**
 * What one agent can really call: the tool set its module declares for its agent (a copied agent: the module of its installation), the
 * provider tools its ticked abilities add per attached account, and the default context reads, each with the owner's restricting grant
 * row. Owner or manager only (the rights board proves the role).
 */
export class AgentToolLinesService {
    constructor(
        private readonly admin: ToolsConsoleService,
        private readonly agents: AgentDirectoryService,
        private readonly installations: InstallationRecordsService,
    ) {}

    /** The tools of the agent in the shop's words; empty for an agent the workspace does not have. */
    async lines(userId: string, workspaceId: string, agentId: string): Promise<ReadonlyArray<AgentToolLine>> {
        const actor = { principalId: userId, workspaceId }
        const board = await this.admin.providerBoard(actor)
        const agent = await this.agents.find(workspaceId, agentId)
        if (agent === null) return []
        const [installation, grants] = await Promise.all([
            this.installations.ofAgent(workspaceId, agentId),
            this.admin.grants(actor),
        ])
        const moduleKey = installation?.moduleKey ?? agent.module
        return agentToolsOf({
            declared: INSTALLED.agentToolsOf(moduleKey) ?? [],
            defaultReads: DEFAULT_READ_TOOLS,
            attachments: board.attachments.filter((row) => row.agentId === agentId),
            accountLabels: new Map(
                board.providers.flatMap((provider) =>
                    provider.accounts.map((account) => [account.connectionId, account.label] as const),
                ),
            ),
            grants: grants.filter((grant) => grant.agentId === agentId),
            catalogue: PROVIDER_CATALOGUE,
            wordsOf: INSTALLED.toolLabelOf,
        })
    }
}
