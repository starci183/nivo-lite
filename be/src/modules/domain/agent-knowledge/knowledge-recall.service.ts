import { Injectable } from "@nestjs/common"
import { BrainFactsService, visibleTo, waitingCardCount, type FactRecord } from "@modules/domain/brain-facts"
import type { KnowledgeView } from "./agent-knowledge.contracts"

/** The whole view of facts is read at most this many at a time; a workspace keeps a few hundred. */
const VIEW_LIMIT = 500

@Injectable()
/**
 * The facts one agent may read, through its view: those in force, those waiting inside the view, and those that match a question.
 * Nothing here builds a prompt: an agent pulls passages on demand through its tools (`nivo.tool.brain.passage.search` / `.read`), and
 * the truths through the fact tools.
 */
export class KnowledgeRecallService {
    constructor(private readonly facts: BrainFactsService) {}

    /** Every fact in force inside the view, up to `limit`. */
    async factsInView(view: KnowledgeView, limit: number): Promise<ReadonlyArray<FactRecord>> {
        const all = await this.facts.forView(
            view.workspaceId,
            view.audience,
            view.module,
            view.installationId,
            VIEW_LIMIT,
        )
        return all.slice(0, limit)
    }

    /** The facts the view reads now (active, in force) and the proposals it would read once approved, each inside its module and instance. */
    async factsToOverview(view: KnowledgeView): Promise<ReadonlyArray<FactRecord>> {
        const [active, proposed] = await Promise.all([
            this.facts.forView(view.workspaceId, view.audience, view.module, view.installationId, VIEW_LIMIT),
            this.facts.list(view.workspaceId, { statuses: ["proposed"], limit: VIEW_LIMIT }),
        ])
        return [
            ...active,
            ...proposed.filter((fact) => visibleTo(fact, view.audience, view.module, view.installationId)),
        ]
    }

    /** How many review cards the proposals inside the view make, counted as the Second Brain badge counts them. */
    async waitingInView(view: KnowledgeView): Promise<number> {
        const proposed = await this.facts.list(view.workspaceId, { statuses: ["proposed"], limit: VIEW_LIMIT })
        return waitingCardCount(proposed.filter((fact) => visibleTo(fact, view.audience, view.module, view.installationId)))
    }

    /** The facts in force inside the view that best match a question. */
    factsMatching(view: KnowledgeView, query: string, limit: number): Promise<ReadonlyArray<FactRecord>> {
        return this.facts.search(view.workspaceId, view.audience, view.module, view.installationId, query, limit)
    }
}
