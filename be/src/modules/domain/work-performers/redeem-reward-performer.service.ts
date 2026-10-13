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
import { LoyaltyRedemptionService } from "@modules/domain/loyalty"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PerformerKitService } from "./performer-kit.service"
import { textOf } from "./performer.policy"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

@Injectable()
/**
 * `redeem_reward`: the points of a reward come off the member's balance and the member gets the code to show, once the gate let the
 * request through (by the owner's limit or after a person approved it). The points always follow the catalogue, never an amount the owner
 * edited; the redemption is keyed on the work item, so a repeat takes nothing twice. A request that came from a chat is answered there.
 */
export class RedeemRewardPerformerService implements WorkPerformer {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly kit: PerformerKitService,
        private readonly redemption: LoyaltyRedemptionService,
        private readonly ledger: LoyaltyLedgerService,
        private readonly delivery: CustomerDeliveryService,
    ) {}

    /** The proposal is preset by whoever asked (the chat). */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Redeems the reward and tells the member in the chat the request came from. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const customerId = textOf(proposal.fields.customer_id)
        const rewardId = textOf(proposal.fields.reward_id)
        if (customerId === "" || rewardId === "")
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.SubjectMissing })
        const out = await this.redemption.redeem({
            workspaceId: ctx.workspaceId,
            customerId,
            rewardId,
            ref: `redeem:${item.id}`,
            by: by.name,
        })
        const name = textOf(proposal.fields.customer)
        const params = { name, reward: out.reward.name, code: out.code, cost: out.reward.pointsCost }
        const conversationId = textOf(proposal.fields.conversation_id)
        if (out.posted && conversationId !== "") await this.tell(ctx, conversationId, customerId, params)
        return {
            summary: this.kit.text(ctx, out.posted ? "rewardRedeemed" : "rewardRedeemedBefore", params),
            evidence: "captured",
            lead_id: item.lead_id,
            detail: out.code,
        }
    }

    private async tell(
        ctx: WorkContext,
        conversationId: string,
        customerId: string,
        params: Readonly<Record<string, string | number>>,
    ): Promise<void> {
        const member = await this.ledger.member(ctx.workspaceId, customerId)
        const text = this.kit.text(ctx, "rewardCustomer", { ...params, points: member?.points ?? 0 })
        await this.delivery.inConversation(ctx.workspaceId, conversationId, text).catch((cause: unknown) => {
            this.logger.error(WorkPerformersLogEvent.RedeemNoticeFailed, cause, {
                workspaceId: ctx.workspaceId,
                conversationId,
            })
            return false
        })
    }
}
