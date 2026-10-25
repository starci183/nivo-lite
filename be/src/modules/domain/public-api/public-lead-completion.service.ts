import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type { LeadRequestBody } from "./public-api.contracts"
import { parsePublicLeadBody } from "./public-api-job.policy"
import { DEFAULT_API_NEED } from "./public-api.policy"
import { PublicLeadFulfillmentService } from "./public-lead-fulfillment.service"
import type { PublicLeadMetadata } from "./public-lead-metadata.contracts"
import { parsePublicLeadMetadata, PUBLIC_API_LEAD_METADATA } from "./public-lead-metadata.policy"
import type { PublicApiProcessingRow } from "./persistence/public-api-processing.rows"
import { LOCK_PUBLIC_API_REQUEST } from "./persistence/public-api-processing.sql"
import { LINK_PUBLIC_API_LEAD } from "./persistence/public-lead-completion.sql"

@Injectable()
/** Settles admitted API details after the ordinary handoff gate has resolved a customer. */
export class PublicLeadCompletionService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        private readonly inbound: InboundEventsService,
        private readonly fulfillment: PublicLeadFulfillmentService,
    ) {}

    /** Preserves new-lead notes and stages across delayed approval, with one transactional completion per admission. */
    async complete(
        ctx: WorkContext,
        item: WorkItem,
        leadId: string,
        proposal: Proposal,
        matched: boolean,
    ): Promise<void> {
        const metadata = parsePublicLeadMetadata(item.proposal.fields[PUBLIC_API_LEAD_METADATA])
        if (metadata === null) return
        const inboundEventId = item.inbound_event_id
        if (
            item.workspace_id !== ctx.workspaceId ||
            item.action !== "handoff_lead" ||
            item.subject_type !== "inbound" ||
            inboundEventId === null ||
            item.subject_id !== inboundEventId
        )
            this.invalid()
        await this.entityManager.transaction(async (tx) => {
            const body = await this.admittedBody(ctx.workspaceId, inboundEventId, metadata, tx)
            if (!(await this.inbox.claim("public_api.handoff", `${ctx.workspaceId}:${metadata.completionId}`, tx)))
                return
            const details: LeadRequestBody = {
                ...body,
                company: matched ? String(proposal.fields.company ?? "") : "",
                need: matched ? String(proposal.fields.need ?? "") : body.need,
                needSupplied: matched && (body.needSupplied ?? (body.need !== "" && body.need !== DEFAULT_API_NEED)),
            }
            await this.fulfillment.applyDetails({ ...ctx, actor: body.source }, leadId, details, tx)
            if (metadata.ledgerRequestId !== null) {
                await tx.query(LINK_PUBLIC_API_LEAD, [ctx.workspaceId, metadata.ledgerRequestId, leadId])
            }
        })
    }

    private async admittedBody(
        workspaceId: string,
        inboundEventId: string,
        metadata: PublicLeadMetadata,
        tx: EntityManager,
    ): Promise<LeadRequestBody> {
        const event = await this.inbound.find(workspaceId, inboundEventId, tx)
        if (event?.kind !== "lead" || event.channel !== "manual") return this.invalid()
        if (metadata.ledgerRequestId === null) {
            const body = metadata.body
            if (
                event.id !== metadata.completionId ||
                event.external_ref !== body.source ||
                event.body !== body.need ||
                event.sender_contact !== body.contact ||
                (event.sender_name ?? "") !== body.name
            )
                return this.invalid()
            return body
        }
        const [row] = await tx.query<Array<PublicApiProcessingRow>>(LOCK_PUBLIC_API_REQUEST, [
            workspaceId,
            metadata.ledgerRequestId,
        ])
        if (row?.kind !== "lead" || row.processed_at === null) return this.invalid()
        const body = parsePublicLeadBody(row.payload, row.need_supplied)
        if (event.event_id !== `api:${metadata.completionId}` || event.external_ref !== body.source)
            return this.invalid()
        return body
    }

    private invalid(): never {
        throw new PublicApiError({
            code: PublicApiErrorCode.RequestInvalid,
            params: { field: PUBLIC_API_LEAD_METADATA },
        })
    }
}
