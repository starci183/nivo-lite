import { Injectable } from "@nestjs/common"
import { KnowledgeSourceCitesService, KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { KnowledgeError, KnowledgeErrorCode } from "./errors/knowledge.error"
import { KnowledgeIndexingService } from "./knowledge-indexing.service"
import { reembedPayloadOf, sourcePayloadOf } from "./knowledge-payload.policy"
import { KnowledgeReembedService } from "./knowledge-reembed.service"
import type { OptionalFairGroup } from "./knowledge.contracts"
import { KnowledgeLogEvent } from "./knowledge.log-events"

/** How many sources' documents one process remembers before it forgets them all and reads again. */
const DOCUMENTS_REMEMBERED = 10_000

/** The fair group of every critique run. */
const CRITIQUE_GROUP = "dossier.review"

/** The fair group of the jobs that read one document. */
const documentGroupOf = (documentId: string): string => `document:${documentId}`

@Injectable()
/** What the knowledge jobs do with the payload they are handed: check it, run the capability, and say how the job ended. */
export class KnowledgeJobsService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly indexing: KnowledgeIndexingService,
        private readonly reembedding: KnowledgeReembedService,
        private readonly sources: KnowledgeSourcesService,
        private readonly cites: KnowledgeSourceCitesService,
    ) {}

    /**
     * The fair group of every critique run of the knowledge queue (`dossier.review`): while none runs, one starts even when the truths
     * jobs of a big document fill the workspace's limit (D-R-8: reviews waited up to 8 min); two reviews still share the plain limit.
     */
    critiqueGroupOf(): Promise<OptionalFairGroup> {
        return Promise.resolve(CRITIQUE_GROUP)
    }

    /** The document of a source (the first part of a file cut into parts, else the source itself), remembered: it never changes. */
    private readonly documents = new Map<string, string>()

    /**
     * The fair group of a truths job (`knowledge.facts`): the DOCUMENT it reads, all the parts of a file one group, so the queue starts a
     * job of a document that has nothing running before another part of a document that already has one (D-R-8: a one-page document
     * waited 23 min behind a 10 MB one). One read by primary key the first time a source is asked, none after. Null for a payload of
     * another shape or a source that is gone (the plain limit then applies).
     */
    async fairGroupOf(payload: object): Promise<OptionalFairGroup> {
        const run = sourcePayloadOf(payload)
        if (run === null) return null
        const known = this.documents.get(run.sourceId)
        if (known !== undefined) return documentGroupOf(known)
        const cite = (await this.cites.of(run.workspaceId, [run.sourceId])).get(run.sourceId)
        if (cite === undefined) return null
        const document = cite.firstPartId ?? run.sourceId
        if (this.documents.size >= DOCUMENTS_REMEMBERED) this.documents.clear()
        this.documents.set(run.sourceId, document)
        return documentGroupOf(document)
    }

    /**
     * Indexes the source of the payload; a source that cannot be read is closed as failed, which is a normal end of the job. A payload
     * of another shape is logged and dropped: waiting would not make it right.
     */
    async index(payload: object): Promise<void> {
        const run = sourcePayloadOf(payload)
        if (run === null) {
            this.logger.warn(KnowledgeLogEvent.PayloadRefused, { job: "index" })
            return
        }
        await this.indexing.index(run)
    }

    /** The indexing job ended as failed: the source is closed with the stored code of the cause. */
    async indexFailed(payload: object, cause: unknown): Promise<void> {
        const run = sourcePayloadOf(payload)
        if (run !== null) await this.indexing.failSource(run.workspaceId, run.sourceId, cause)
    }

    /**
     * Embeds the stale passages of the workspace. A job that reaches its batch limit queues its own follow-up; a workspace with no
     * credits left waits (the owner tops up and asks again); a provider that fails makes the job retry; a model this deployment does
     * not embed with is logged and dropped.
     */
    async reembed(payload: object): Promise<void> {
        const run = reembedPayloadOf(payload)
        if (run === null) {
            this.logger.warn(KnowledgeLogEvent.PayloadRefused, { job: "reembed" })
            return
        }
        const model = run.model ?? ""
        const outcome = await this.reembedding.reembed(run.workspaceId, model)
        if (outcome === "more") await this.sources.continueReembed(run.workspaceId, model)
        if (outcome === "mismatch") {
            this.logger.warn(KnowledgeLogEvent.ModelMismatch, { workspaceId: run.workspaceId, model })
        }
        if (outcome === "unavailable") throw new KnowledgeError({ code: KnowledgeErrorCode.EmbeddingUnavailable })
    }
}
