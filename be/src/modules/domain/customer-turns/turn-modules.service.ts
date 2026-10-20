import { Injectable } from "@nestjs/common"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { CustomerTurn } from "@modules/domain/conversations"
import { EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { LoyaltyChatService } from "@modules/domain/loyalty"
import type { ChatCustomerRef } from "@modules/domain/loyalty-customer-links"
import { BookingChatService } from "@modules/domain/work-performers"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { CustomerReply, ModuleOutcome } from "./customer-turns.contracts"
import { GatewayContextService } from "./gateway-context.service"
import { GatewaySalesService } from "./gateway-sales.service"

const LOCALE = "vi"
const ENGINE_ACTOR = "OpenClaw"
const BOOKING = "booking"
const LOYALTY = "loyalty"
const NOTHING: ModuleOutcome = { reply: null, lines: [] }

@Injectable()
/**
 * The booking and loyalty parts of a customer turn. Before the AI step they add the facts the agent may use (the loyalty programme of
 * the customer, read from the ledger, and the booking rules) and the reply-contract members it may fill. After it they run what the
 * reply asked for: a booking request when the agent books or hands over to a booking agent, a reward redemption through the gate.
 */
export class TurnModulesService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly bindings: AgentBindingsService,
        private readonly engine: WorkEngineService,
        private readonly evidence: EvidenceService,
        private readonly booking: BookingChatService,
        private readonly loyalty: LoyaltyChatService,
        private readonly hotelContext: GatewayContextService,
        private readonly hotelSales: GatewaySalesService,
    ) {}

    /** The context blocks of a turn: the loyalty facts when the shop runs a programme, the booking contract when the agent books. */
    async briefs(conversation: TurnConversation): Promise<ReadonlyArray<string>> {
        const module = conversation.agent.module
        const [loyalty, books, hotel] = await Promise.all([
            this.loyalty.brief(this.refOf(conversation)),
            this.booksIn(conversation),
            this.hotelBrief(conversation),
        ])
        const loyaltyContract = loyalty !== "" && module !== LOYALTY ? this.text("bundle.loyaltyContract") : ""
        const bookingData = books ? await this.booking.brief(conversation.workspaceId) : ""
        const bookingContract = books && module !== BOOKING ? this.text("bundle.bookingAddendum") : ""
        return [loyalty, loyaltyContract, bookingData, bookingContract, ...hotel].filter((part) => part !== "")
    }

    /**
     * The hotel block of an agent granted HAKUEN tools: the guest and stay context read through the gateway and the `hotel_request`
     * contract. The lifecycle hand-over runs here too, so the next turn answers as the new owner; a context HAKUEN cannot give keeps
     * the turn and the owner as they are, with the contract alone.
     */
    private async hotelBrief(conversation: TurnConversation): Promise<ReadonlyArray<string>> {
        if (!(await this.hotelContext.servesHotel(conversation))) return []
        const context = await this.hotelContext.contextOf(conversation)
        if (context === null)
            return this.hotelContext.briefOf({
                guestId: null,
                name: "",
                tier: "",
                stayId: null,
                room: "",
                stage: { kind: "none" },
            })
        await this.hotelContext.route(conversation, context)
        return this.hotelContext.briefOf(context)
    }

    /** Runs the booking request and the redemption the reply named; the booking answer replaces the reply when it has one. */
    async settle(ctx: WorkContext, turn: CustomerTurn, reply: CustomerReply): Promise<ModuleOutcome> {
        const booking = reply.bookingRequest === null ? NOTHING : await this.settleBooking(ctx, turn, reply)
        const hotel =
            reply.hotelRequest === null || !(await this.hotelContext.servesHotel(turn.conversation))
                ? NOTHING
                : await this.hotelSales.settle(ctx, turn.conversation, turn.messageId, reply.hotelRequest)
        const redeem = reply.loyaltyRewardKey === null ? [] : await this.redeem(ctx, turn, reply.loyaltyRewardKey)
        return { reply: hotel.reply ?? booking.reply, lines: [...booking.lines, ...hotel.lines, ...redeem] }
    }

    private async settleBooking(ctx: WorkContext, turn: CustomerTurn, reply: CustomerReply): Promise<ModuleOutcome> {
        const { conversation } = turn
        if (reply.bookingRequest === null || !(await this.booksIn(conversation))) return NOTHING
        const answer = await this.booking.apply({
            workspaceId: ctx.workspaceId,
            conversationId: conversation.id,
            leadId: conversation.leadId,
            messageId: turn.messageId,
            visitorName: conversation.visitorName ?? "",
            request: reply.bookingRequest,
        })
        await this.evidence.log(ctx, {
            lead_id: conversation.leadId,
            kind: "booking.chat_request",
            actor: ENGINE_ACTOR,
            summary: this.text("customerTurns.bookingEvidence", {
                intent: reply.bookingRequest.intent,
                state: answer.state,
            }),
            evidence: turn.messageId,
        })
        return { reply: answer.reply, lines: [] }
    }

    /** A clear redeem becomes a gated `redeem_reward` item (auto within the owner's limit, else a decision); a blocked one is noted. */
    private async redeem(ctx: WorkContext, turn: CustomerTurn, rewardKey: string): Promise<ReadonlyArray<string>> {
        const { conversation } = turn
        const intent = await this.loyalty.redeemIntent(this.refOf(conversation), rewardKey)
        if (intent.kind === "none") return []
        const params = { name: intent.customerName, reward: intent.reward.name, cost: String(intent.reward.pointsCost) }
        if (intent.kind === "blocked") {
            await this.evidence.log(ctx, {
                lead_id: conversation.leadId,
                kind: "loyalty.redeem_blocked",
                actor: ENGINE_ACTOR,
                summary: this.text("customerTurns.redeemBlocked", { ...params, reason: intent.reason }),
                evidence: turn.messageId,
            })
            return []
        }
        await this.engine.runWork(ctx, {
            action: "redeem_reward",
            subject_type: "conversation",
            subject_id: conversation.id,
            lead_id: conversation.leadId,
            origin: "live",
            preset: true,
            noChain: true,
            dedupeKey: `redeem_reward:message:${turn.messageId}`,
            seed: {
                summary: this.text("performers.redeemSummary", params),
                amount_vnd: intent.reward.valueVnd,
                fields: {
                    customer: intent.customerName,
                    customer_id: intent.customerId,
                    reward_id: intent.reward.id,
                    reward: intent.reward.name,
                    amount_vnd: intent.reward.valueVnd,
                    conversation_id: conversation.id,
                    source: "chat",
                },
            },
        })
        return [this.text("customerTurns.redeemAsked", params)]
    }

    /** True when the agent books, or is the front door that hands over to a booking agent on this connection. */
    private async booksIn(conversation: TurnConversation): Promise<boolean> {
        if (conversation.agent.module === BOOKING) return true
        const handovers = await this.bindings.handoversOf(conversation.connectionId, {
            module: conversation.agent.module,
        })
        return handovers.some((agent) => agent.module === BOOKING)
    }

    private refOf(conversation: TurnConversation): ChatCustomerRef {
        return {
            workspaceId: conversation.workspaceId,
            conversationId: conversation.id,
            leadId: conversation.leadId,
            channel: conversation.channel,
            externalId: conversation.externalId,
        }
    }

    private text(key: string, params: Readonly<Record<string, string>> = {}): string {
        return this.catalog.get(key, params, LOCALE)
    }
}
