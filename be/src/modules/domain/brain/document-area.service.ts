import { Injectable } from "@nestjs/common"
import { BrainFactAreasService } from "@modules/domain/brain-facts"
import {
    KnowledgeSourcesLogEvent,
    KnowledgeSourcesReadService,
    KnowledgeSourcesService,
    type SourceMove,
    type UpdateSourceInput,
} from "@modules/domain/knowledge-sources"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { DocumentReviewService } from "./document-review.service"

@Injectable()
/**
 * THE MOVE of a document between the Second Brain's two upload areas (owner 2026-11-12: a document's area is the audience of every
 * passage and every truth read from it; the founder moves a document, and it is audited). One door for every caller (the Knowledge
 * page's mutation and the brain's command runner): the metadata change, then what follows a move.
 */
export class DocumentAreaService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly sources: KnowledgeSourcesService,
        private readonly states: KnowledgeSourcesReadService,
        private readonly facts: BrainFactAreasService,
        private readonly review: DocumentReviewService,
    ) {}

    /**
     * Changes a document's metadata (`KnowledgeSourcesService.updateSource`: role, the area's cap under the lock, its passages and their
     * vectors in the same transaction). When it names an area: (1) the move is recorded (`knowledge_sources.area.moved`: who, the
     * document, its parts, from, to; the log line carries the instant); (2) its truths follow (`BrainFactAreasService.followDocumentAreas`:
     * each truth in force a new version decided by the mover with a note naming the move, the audit of every truth); (3) a move INTO the
     * public area asks the security read again (`DocumentReviewService.requestForSource`), so a passage the read never had to review for
     * an internal document is reviewed before a customer is served it; until then the trust gate withholds it. Moving out needs no read:
     * a customer read needs the public area. Asking the same area again finishes a move that stopped half way.
     */
    async update(userId: string, workspaceId: string, input: UpdateSourceInput): Promise<void> {
        const move = await this.sources.updateSource(userId, workspaceId, input)
        if (move !== null) await this.follow(userId, workspaceId, move)
    }

    /** What follows a written move: the audit line, the truths, and the security read of a document that entered the public area. */
    private async follow(userId: string, workspaceId: string, move: SourceMove): Promise<void> {
        const [sourceId] = move.sourceIds
        this.logger.info(KnowledgeSourcesLogEvent.AreaMoved, {
            workspaceId,
            sourceId,
            parts: move.sourceIds.length - 1,
            from: move.from,
            to: move.to,
            movedBy: userId,
        })
        const changed = await this.facts.followDocumentAreas(
            workspaceId,
            move.sourceIds,
            (ids) => this.publicOf(workspaceId, ids),
            move.movedBy,
            `"${move.title}" ${move.from} -> ${move.to}`,
        )
        this.logger.info(KnowledgeSourcesLogEvent.AreaTruthsFollowed, { workspaceId, sourceId, truths: changed.length })
        if (move.to === "public" && move.from !== "public") {
            await eachInOrder(move.sourceIds, (id) => this.review.requestForSource(workspaceId, id))
        }
    }

    /** Which of these documents are in the public area now (a document gone is in none). */
    private async publicOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlySet<string>> {
        const states = await this.states.statesOf(workspaceId, ids)
        return new Set(states.filter((state) => state.visibility === "public").map((state) => state.id))
    }
}
