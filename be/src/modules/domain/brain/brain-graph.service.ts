import { Injectable } from "@nestjs/common"
import { BrainFactRelationsService, BrainFactsReadService } from "@modules/domain/brain-facts"
import type { FactRelation, RelationKind } from "@modules/domain/brain-facts"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { graphOf, subjectPageOf } from "./brain-graph.policy"
import type { BrainGraph, BrainGraphFilter } from "./brain.contracts"
import { MANAGERS } from "./founder.policy"

/** The most truths and proposals one graph read looks across: a workspace keeps a few hundred. */
const GRAPH_WINDOW = 2000

/** One page of the graph a workspace member asks for. */
export interface GraphRequest extends BrainGraphFilter {
    /** The workspace. */
    readonly workspaceId: string
}

/** An edge to remove. */
export interface GraphUnlinkRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The edge. */
    readonly id: string
}

/** An edge the page draws by hand. */
export interface GraphLinkForm {
    /** The workspace. */
    readonly workspaceId: string
    /** The truth it starts from. */
    readonly fromFactId: string
    /** The truth it points at. */
    readonly toFactId: string
    /** How they relate. */
    readonly kind: RelationKind
    /** The relation in the owner's words, or null. */
    readonly label?: string | null | undefined
}

@Injectable()
/**
 * The truth graph as the Second Brain page shows it (owner's picture "second-brain-truth"): nodes = truths in force with their
 * source, version and validity; edges = relations; the change requests waiting for the founder; the source documents and how far
 * their reading got. The founder and the managers read it and draw or remove edges; only the founder approves a change request
 * (through the existing fact decision).
 */
export class BrainGraphService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly reads: BrainFactsReadService,
        private readonly relations: BrainFactRelationsService,
        private readonly extractions: BrainExtractionsService,
    ) {}

    /** One page of the graph, paged by subject. */
    async graph(userId: string, request: GraphRequest): Promise<BrainGraph> {
        const { workspaceId, ...filter } = request
        await this.members.require(userId, workspaceId, MANAGERS)
        const [facts, proposals, readings] = await Promise.all([
            this.reads.list(workspaceId, { statuses: ["active", "scheduled"], limit: GRAPH_WINDOW }),
            this.reads.list(workspaceId, { statuses: ["proposed"], limit: GRAPH_WINDOW }),
            this.extractions.progress(workspaceId),
        ])
        const page = subjectPageOf(facts, filter)
        const ids = new Set(facts.map((fact) => fact.id))
        const edges = (await this.relations.ofFacts(workspaceId, [...ids])).filter(
            (edge) => ids.has(edge.fromFactId) && ids.has(edge.toFactId),
        )
        const pageIds = new Set(facts.filter((fact) => page.subjects.includes(fact.subjectKey)).map((fact) => fact.id))
        const pageEdges = edges.filter((edge) => pageIds.has(edge.fromFactId) || pageIds.has(edge.toFactId))
        const replaced = facts.flatMap((fact) => (fact.supersedesId === null ? [] : [fact.supersedesId]))
        const previous = new Map((await this.reads.byIds(workspaceId, replaced)).map((fact) => [fact.id, fact]))
        return graphOf(
            { facts, proposals, previous, relations: pageEdges, readings, relationTotal: edges.length },
            page,
            this.clock.now().getTime(),
        )
    }

    /** Draws an edge between two truths of the workspace; the same edge again answers the stored one. */
    async link(userId: string, form: GraphLinkForm): Promise<FactRelation> {
        const { workspaceId, ...edge } = form
        const me = await this.members.require(userId, workspaceId, MANAGERS)
        return this.relations.link(workspaceId, { ...edge, createdBy: me.displayName })
    }

    /** Removes an edge of the workspace; answers whether it was there. */
    async unlink(userId: string, request: GraphUnlinkRequest): Promise<boolean> {
        await this.members.require(userId, request.workspaceId, MANAGERS)
        return this.relations.unlink(request.workspaceId, request.id)
    }
}
