import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { EvidenceService } from "@modules/domain/decisions"
import type { Performed, PerformedBy, WorkContext, WorkItem } from "@modules/domain/decisions"
import type { CustomerDelivery, DeliveryContact, DeliveryCustomer } from "./work-performers.contracts"
import { PerformerKitService } from "./performer-kit.service"
import { leadHref } from "./performer.policy"

/** The conversation channel the website chat page reads itself: nothing is pushed. */
const WEBSITE_CHANNEL = "website"

@Injectable()
/**
 * Delivers the company's words to a customer with honest labels: stored in their conversation, pushed to the channel they are on, and
 * recorded as simulated when there is no conversation to answer in.
 */
export class CustomerDeliveryService {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly channels: ChannelDeliveryService,
        private readonly evidence: EvidenceService,
    ) {}

    /** How the owner reaches the customer on the card: the phone, else the email, else "website" when they chat on the site. */
    async contactOf(workspaceId: string, lead: DeliveryContact): Promise<string | null> {
        if (lead.phone !== null) return lead.phone
        if (lead.email !== null) return lead.email
        return (await this.conversations.latestOfLead(workspaceId, lead.id, null)) === null ? null : WEBSITE_CHANNEL
    }

    /** Delivers the approved text to the customer, leaves the evidence line of its kind, and reports what was done. */
    async sendAndLog(
        ctx: WorkContext,
        item: WorkItem,
        customer: DeliveryCustomer,
        text: string,
        by: PerformedBy,
        kind: string,
    ): Promise<Performed> {
        const sent = await this.toCustomer(ctx, customer, text, item.origin)
        await this.evidence.log(ctx, {
            lead_id: customer.id,
            work_item_id: item.id,
            kind,
            actor: by.name,
            summary: sent.summary,
            evidence: text,
        })
        return {
            summary: sent.summary,
            evidence: "captured",
            href: leadHref(customer.id),
            lead_id: customer.id,
            detail: text,
        }
    }

    /** Records simulation honestly; live work delivers in the customer's latest conversation. */
    async toCustomer(
        ctx: WorkContext,
        customer: DeliveryCustomer,
        text: string,
        origin: string = "live",
    ): Promise<CustomerDelivery> {
        if (origin === "simulated") {
            return { summary: this.kit.text(ctx, "simulatedDelivery", { channel: customer.channel }), real: false }
        }
        const conversation = await this.conversations.latestOfLead(ctx.workspaceId, customer.id, null)
        if (conversation === null) {
            return { summary: this.kit.text(ctx, "simulatedDelivery", { channel: customer.channel }), real: false }
        }
        const sent = await this.inConversation(ctx.workspaceId, conversation.id, text)
        if (conversation.channel === WEBSITE_CHANNEL) {
            return { summary: this.kit.text(ctx, "deliveredWebsite", { name: customer.contact_name }), real: true }
        }
        const key = sent ? "deliveredTelegram" : "telegramFailed"
        return { summary: this.kit.text(ctx, key, { name: customer.contact_name }), real: sent }
    }

    /** Stores the message in the conversation and pushes it to the customer's channel; true when the channel accepted it. */
    async inConversation(workspaceId: string, conversationId: string, text: string): Promise<boolean> {
        const messageId = await this.messages.storeAgentMessage(workspaceId, conversationId, text)
        const target = await this.conversations.targetOf(conversationId)
        if (target.kind !== "ok" || target.value.channel === WEBSITE_CHANNEL) return false
        return (await this.channels.deliver({ conversationId, messageId, text })).delivered
    }

    /** Stores the approved answer once with the deciding member's name and records its real delivery outcome. */
    async approvedInConversation(
        workspaceId: string,
        conversationId: string,
        text: string,
        memberName: string,
        workItemId: string,
    ): Promise<boolean> {
        const target = await this.conversations.targetOf(conversationId)
        if (target.kind !== "ok" || target.value.workspaceId !== workspaceId) return false
        const messageId = await this.messages.storeHumanMessage(
            workspaceId,
            conversationId,
            text,
            memberName,
            undefined,
            workItemId,
        )
        const message = await this.messages.find(messageId, conversationId)
        if (message.kind === "ok" && message.value.deliveryStatus === "sent")
            return target.value.channel !== WEBSITE_CHANNEL
        if (target.value.channel === WEBSITE_CHANNEL) {
            await this.messages.markDelivery(messageId, true)
            return false
        }
        return (await this.channels.deliver({ conversationId, messageId, text })).delivered
    }
}
