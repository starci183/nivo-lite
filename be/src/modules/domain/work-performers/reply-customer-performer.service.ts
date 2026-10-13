import { Injectable } from "@nestjs/common"
import type { Performed, Prepared, Proposal, WorkContext, WorkItem, WorkPerformer } from "@modules/domain/decisions"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PerformerKitService } from "./performer-kit.service"
import { leadHref, textOf } from "./performer.policy"

@Injectable()
/** `reply_customer`: the answer the owner approved is stored in the customer's conversation and pushed to their channel. */
export class ReplyCustomerPerformerService implements WorkPerformer {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly delivery: CustomerDeliveryService,
    ) {}

    /** The proposal is preset by whoever asked for the approval. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Stores the approved answer and pushes it to the channel. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const conversationId = textOf(proposal.fields.conversation_id)
        const pushed =
            conversationId !== "" && proposal.draft !== undefined && proposal.draft !== ""
                ? await this.delivery.inConversation(ctx.workspaceId, conversationId, proposal.draft)
                : false
        return {
            summary: this.kit.text(ctx, pushed ? "replyPostedTelegram" : "replyPosted"),
            evidence: "captured",
            href: leadHref(item.lead_id),
            lead_id: item.lead_id,
            detail: proposal.draft ?? null,
        }
    }
}
