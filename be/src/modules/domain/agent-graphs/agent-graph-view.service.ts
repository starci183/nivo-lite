import { Injectable } from "@nestjs/common"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { AgentGraphView, GraphDocument, GraphProposalView } from "./agent-graphs.contracts"
import { graphGapsOf } from "./policies/graph-gaps.policy"
import { graphProblems } from "./policies/graph-problems.policy"
import { nodeCardOf } from "./policies/node-card.policy"

/** The passage a graph cites for a Brain fact: what the owner confirmed, or null when no node cites it. */
const citedPassageOf = (graph: GraphDocument, factId: string): string | null => {
    for (const node of graph.nodes) {
        const sources = [...node.sources, ...(node.decide?.branches.flatMap((branch) => branch.sources) ?? [])]
        for (const source of sources) if (source.kind === "brain" && source.factId === factId) return source.passage
    }
    return null
}

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
        private readonly brain: BrainFactsService,
    ) {}

    /** The view of the graph of an agent for the editor. */
    async viewOf(workspaceId: string, agentId: string, locale: Locale): Promise<AgentGraphView> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        const installation = state === null ? null : await this.installations.findById(state.installationId)
        if (state === null || installation === null)
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
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
            isDraftChanged: JSON.stringify(state.draft) !== JSON.stringify(state.active),
            activeVersionId: state.activeVersionId,
            gaps: graphGapsOf(state.draft, context),
            problems: graphProblems(state.draft, context),
            cards: state.draft.nodes.map((node) => nodeCardOf(node, nameOf(node.approver?.group.members[0]), say)),
            proposals: await Promise.all(proposals.map((proposal) => this.withPassages(workspaceId, state.draft, proposal))),
            facts: Object.values(context.facts).map((spec) => ({
                key: spec.key,
                label: say(spec.labelKey),
                type: spec.type,
                unit: spec.unit,
                allowed: spec.allowed ?? [],
            })),
        }
    }

    /** A conflict with the two passages it is about, so the owner reads the old rule and the new one side by side. */
    private async withPassages(
        workspaceId: string,
        graph: GraphDocument,
        proposal: GraphProposalView,
    ): Promise<GraphProposalView> {
        const [oldId, newId] = proposal.evidence
        if (proposal.kind !== "conflict" || oldId === undefined || newId === undefined) return proposal
        const [old, current] = await Promise.all([this.brain.get(workspaceId, oldId), this.brain.get(workspaceId, newId)])
        return { ...proposal, before: citedPassageOf(graph, oldId) ?? old?.value ?? "", after: current?.value ?? "" }
    }
}
