import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { ApiKnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type { ClaimedJob, JobClaims, JobFenceService } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { PublicApiQueueJob, PUBLIC_API_QUEUE } from "@modules/queues/public-api"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import { parsePublicApiBody, parsePublicApiJob } from "./public-api-job.policy"
import type { PublicApiJob } from "./public-api-job.contracts"
import { PublicApiLedgerService } from "./public-api-ledger.service"
import { PublicLeadFulfillmentService } from "./public-lead-fulfillment.service"
import { PublicMessageFulfillmentService } from "./public-message-fulfillment.service"

@Injectable()
/** Fulfills API admissions with inbox dedupe, domain writes and downstream jobs in one fence-held transaction. */
export class PublicApiProcessingService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        private readonly knowledge: ApiKnowledgeSourcesService,
        private readonly leads: PublicLeadFulfillmentService,
        private readonly messages: PublicMessageFulfillmentService,
        private readonly events: EventsService,
        private readonly ledger: PublicApiLedgerService,
    ) {}

    /** Both historical implicit names and current named requests route through this queue's processor. */
    assertJobKind(kind: string): void {
        if (kind !== PublicApiQueueJob.Request && kind !== PUBLIC_API_QUEUE) {
            throw new PublicApiError({ code: PublicApiErrorCode.RequestInvalid, params: { field: "job" } })
        }
    }

    /** Advances the supported delivery and applies its effects under the caller's current job fence. */
    async processFenced(job: ClaimedJob, claims: JobClaims, fence: JobFenceService): Promise<void> {
        this.assertJobKind(job.kind)
        await claims.advance({
            jobId: job.jobId,
            expectedFencingToken: job.fencingToken,
            step: "public-api",
        })
        await fence.write(job, (tx) => this.process(job.payload, tx))
    }

    /** The caller owns the live fence and supplies its transaction; no nested transaction may outlive it. */
    async process(payload: object, tx: EntityManager): Promise<void> {
        const job = parsePublicApiJob(payload)
        if (job.format === "ledger") {
            await this.processRequest(job.workspaceId, job.requestId, tx)
            return
        }
        if (!(await this.inbox.claim(PUBLIC_API_QUEUE, `${job.workspaceId}:${job.format}:${job.identity}`, tx))) return
        await this.processLegacy(job, tx)
    }

    /** Records terminal failure evidence while the standard transport retains and archives the original job. */
    async failDelivery(delivery: QueueDelivery): Promise<void> {
        let job: PublicApiJob
        try {
            job = parsePublicApiJob(delivery.payload)
        } catch (cause) {
            if (cause instanceof PublicApiError && cause.code === PublicApiErrorCode.RequestInvalid) return
            throw cause
        }
        await this.entityManager.transaction(async (tx) => {
            if (job.format === "ledger") {
                const row = await this.ledger.lock(job.workspaceId, job.requestId, tx)
                if (row?.processedAt !== null) return
            }
            if (!(await this.inbox.claim("public_api.failed", delivery.id, tx))) return
            await this.events.record(
                {
                    workspaceId: job.workspaceId,
                    kind: "api.failed",
                    actor: "NIVO",
                    summary: "Public API request exhausted its queue attempts; operator recovery is required",
                    evidence: delivery.id,
                },
                tx,
            )
        })
    }

    private async processRequest(workspaceId: string, requestId: string, tx: EntityManager): Promise<void> {
        const row = await this.ledger.lock(workspaceId, requestId, tx)
        if (row === null) throw new PublicApiError({ code: PublicApiErrorCode.RequestNotFound })
        if (row.processedAt !== null) return
        const request = parsePublicApiBody(row.kind, row.payload, row.needSupplied)
        if (!(await this.inbox.claim(PUBLIC_API_QUEUE, `${workspaceId}:${requestId}`, tx))) {
            throw new PublicApiError({ code: PublicApiErrorCode.InboxInconsistent })
        }
        let leadId = row.leadId
        switch (request.kind) {
            case "knowledge":
                await this.knowledge.addText(
                    {
                        sourceId: requestId,
                        workspaceId,
                        ...request.body,
                        origin: request.body.source,
                    },
                    tx,
                )
                await this.events.record(
                    {
                        workspaceId,
                        kind: "api.knowledge",
                        actor: request.body.source,
                        summary: "Knowledge accepted through the API",
                        evidence: `source=${requestId} visibility=${request.body.visibility}`,
                    },
                    tx,
                )
                break
            case "lead":
                leadId = await this.leads.fulfill(workspaceId, requestId, request.body, tx)
                break
            case "message":
                leadId = await this.messages.fulfill(workspaceId, requestId, request.body, row.createdAt, tx)
                break
        }
        await this.ledger.complete(workspaceId, requestId, leadId, tx)
    }

    private async processLegacy(job: Exclude<PublicApiJob, { format: "ledger" }>, tx: EntityManager): Promise<void> {
        switch (job.format) {
            case "knowledge":
                await this.knowledge.indexExisting(job.workspaceId, job.sourceId, tx)
                return
            case "lead":
                await this.leads.fulfillExistingInbound(job.workspaceId, job.identity, job.body, tx)
                return
            case "message":
                await this.messages.fulfill(job.workspaceId, job.identity, job.body, null, tx, job.dedupeKey, false)
        }
    }
}
