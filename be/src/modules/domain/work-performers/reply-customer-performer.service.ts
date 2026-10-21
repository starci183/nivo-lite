import { Injectable } from "@nestjs/common"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
} from "@modules/domain/decisions"
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
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by?: PerformedBy): Promise<Performed> {
        const conversationId = textOf(proposal.fields.conversation_id)
        const pushed =
            conversationId !== "" && proposal.draft !== undefined && proposal.draft !== ""
                ? await this.answer(ctx, item, conversationId, proposal.draft, by)
                : false
        return {
            summary: this.kit.text(ctx, pushed ? "replyPostedTelegram" : "replyPosted"),
            evidence: "captured",
            href: leadHref(item.lead_id),
            lead_id: item.lead_id,
            detail: proposal.draft ?? null,
        }
    }

    private answer(
        ctx: WorkContext,
        item: WorkItem,
        conversationId: string,
        text: string,
        by: PerformedBy | undefined,
    ): Promise<boolean> {
        return by !== undefined && "kind" in by && (by.kind === "owner" || by.kind === "staff")
            ? this.delivery.approvedInConversation(ctx.workspaceId, conversationId, text, by.name, item.id)
            : this.delivery.inConversation(ctx.workspaceId, conversationId, text)
    }
}
