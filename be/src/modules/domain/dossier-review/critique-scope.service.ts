import { Injectable } from "@nestjs/common"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { exemptPassageIds } from "./critique-truth-gate.policy"
import type { CriticPassage } from "./document-critic.contracts"
import { DossierReviewLogEvent } from "./dossier-review.log-events"

@Injectable()
/**
 * Which passages of a document the critic's MODEL has to read (the minimal set, owner 2026-11-11: one critique per changed passage,
 * and no call a gate does not need). It reads the document's level and what triage made of each passage; the rule of the model's set
 * is `exemptPassageIds`.
 */
export class CritiqueScopeService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly chunks: KnowledgeChunksService,
        private readonly states: KnowledgeSourcesReadService,
    ) {}

    /**
     * The hashes of the passages no model call is spent on: an INTERNAL document's passages triage judged `data` or `none`. A public
     * document exempts nothing (customers are served its passages), and a failed read exempts nothing (every passage is then reviewed).
     */
    async exemptOf(workspaceId: string, sourceId: string, passages: ReadonlyArray<CriticPassage>): Promise<ReadonlySet<string>> {
        try {
            const [source] = await this.states.statesOf(workspaceId, [sourceId])
            if (source?.visibility !== "internal") return new Set()
            const judged = await this.chunks.truthPassagesOf(workspaceId, sourceId)
            const exempt = exemptPassageIds(judged.map((one) => ({ id: one.id, visibility: source.visibility, triage: one.triage })))
            return new Set(passages.filter((passage) => exempt.has(passage.id)).map((passage) => passage.hash))
        } catch (cause) {
            this.logger.error(DossierReviewLogEvent.CritiqueFailed, cause, { sourceId })
            return new Set()
        }
    }
}
