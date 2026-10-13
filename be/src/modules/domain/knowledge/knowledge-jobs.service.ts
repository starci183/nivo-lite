import { Injectable } from "@nestjs/common"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeError, KnowledgeErrorCode } from "./errors/knowledge.error"
import { KnowledgeIndexingService } from "./knowledge-indexing.service"
import { reembedPayloadOf, sourcePayloadOf } from "./knowledge-payload.policy"
import { KnowledgeReembedService } from "./knowledge-reembed.service"
import { KnowledgeLogEvent } from "./knowledge.log-events"

@Injectable()
/** What the knowledge jobs do with the payload they are handed: check it, run the capability, and say how the job ended. */
export class KnowledgeJobsService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly indexing: KnowledgeIndexingService,
        private readonly reembedding: KnowledgeReembedService,
        private readonly sources: KnowledgeSourcesService,
    ) {}

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
