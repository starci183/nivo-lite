import { Injectable } from "@nestjs/common"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { AgentGraphView } from "./agent-graphs.contracts"
import { graphGapsOf } from "./policies/graph-gaps.policy"
import { graphProblems } from "./policies/graph-problems.policy"
import { nodeCardOf } from "./policies/node-card.policy"

@Injectable()
/**
 * The graph of an agent as the owner opens it: the draft, what is wrong with it, what is still vague, each node as a card that reads
 * plainly, and the proposals waiting for a person. Every number and name on a card comes from the registries and the people of the
 * workspace, never from a model.
 */
export class AgentGraphViewService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly graphs: AgentGraphsService,
        private readonly context: AgentGraphContextService,
        private readonly proposals: AgentGraphProposalsService,
        private readonly installations: InstallationRecordsService,
        private readonly members: MemberGrantsService,
    ) {}

    /** The view of the graph of an agent for the editor. */
    async viewOf(workspaceId: string, agentId: string, locale: Locale): Promise<AgentGraphView> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        const installation = state === null ? null : await this.installations.findById(state.installationId)
        if (state === null || installation === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        const [context, directory, proposals] = await Promise.all([
            this.context.contextOf({ ...state, moduleKey: installation.moduleKey }, state.draft),
            this.members.directory(workspaceId),
            this.proposals.openOf(workspaceId, agentId),
        ])
        const say = (key: string, params?: Readonly<Record<string, string | number>>): string =>
            this.catalog.get(key, params ?? {}, locale)
        const nameOf = (memberId: string | undefined): string | null =>
            directory.find((member) => member.memberId === memberId)?.name ?? null
        return {
            agentId,
            installationId: state.installationId,
            mode: state.mode,
            draft: state.draft,
            draftRev: state.draftRev,
            activeVersionId: state.activeVersionId,
            gaps: graphGapsOf(state.draft, context),
            problems: graphProblems(state.draft, context),
            cards: state.draft.nodes.map((node) => nodeCardOf(node, nameOf(node.approver?.group.members[0]), say)),
            proposals,
        }
    }
}
