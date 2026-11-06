import { Injectable } from "@nestjs/common"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { CustomerTurn } from "@modules/domain/conversations"
import { EvidenceService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { BookingChatService } from "@modules/domain/work-performers"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { CustomerReply, ModuleOutcome } from "./customer-turns.contracts"
import { GatewayContextService } from "./gateway-context.service"

const LOCALE = "vi"
const ENGINE_ACTOR = "OpenClaw"
const BOOKING = "booking"
const NOTHING: ModuleOutcome = { reply: null, lines: [] }

@Injectable()
/**
 * The booking part of a customer turn. Before the AI step it adds the facts the agent may use (the booking rules) and the
 * reply-contract members it may fill. After it, it runs what the reply asked for: a booking request when the agent books or hands
 * over to a booking agent.
 */
export class TurnModulesService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly bindings: AgentBindingsService,
        private readonly evidence: EvidenceService,
        private readonly booking: BookingChatService,
        private readonly connectors: GatewayContextService,
    ) {}

    /** The context blocks of a turn: the booking contract when the agent books, and the connector block. */
    async briefs(conversation: TurnConversation): Promise<ReadonlyArray<string>> {
        const module = conversation.agent.module
        const [books, connectors] = await Promise.all([this.booksIn(conversation), this.connectorBrief(conversation)])
        const bookingData = books ? await this.booking.brief(conversation.workspaceId) : ""
        const bookingContract = books && module !== BOOKING ? this.text("bundle.bookingAddendum") : ""
        return [bookingData, bookingContract, ...connectors].filter((part) => part !== "")
    }

    /**
     * The connector block of an agent holding connector grants: the meta-tool clause and, when a connector knows the customer, who they
     * are. What to call and in which order comes from the business knowledge, never from NIVO.
     */
    private async connectorBrief(conversation: TurnConversation): Promise<ReadonlyArray<string>> {
        if (!(await this.connectors.servesConnectors(conversation))) return []
        return this.connectors.briefOf(await this.connectors.partyOf(conversation))
    }

    /**
     * Runs the booking request the reply named; the booking answer replaces the reply when it has one. A customer
     * who gave their name becomes a party of the connector that plays `identity.upsert`.
     */
    async settle(ctx: WorkContext, turn: CustomerTurn, reply: CustomerReply): Promise<ModuleOutcome> {
        const booking = reply.bookingRequest === null ? NOTHING : await this.settleBooking(ctx, turn, reply)
        if (reply.lead !== null && (await this.connectors.servesConnectors(turn.conversation))) {
            await this.connectors.remember(turn.conversation, reply.lead, turn.messageId)
        }
        return { reply: booking.reply, lines: booking.lines }
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

    /** True when the agent books, or is the front door that hands over to a booking agent on this connection. */
    private async booksIn(conversation: TurnConversation): Promise<boolean> {
        if (conversation.agent.module === BOOKING) return true
        const handovers = await this.bindings.handoversOf(conversation.connectionId, {
            module: conversation.agent.module,
        })
        return handovers.some((agent) => agent.module === BOOKING)
    }

    private text(key: string, params: Readonly<Record<string, string>> = {}): string {
        return this.catalog.get(key, params, LOCALE)
    }
}
