import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import type { DeliveryRequest, DeliveryResult, RenewalNotification } from "@modules/domain/channels"
import { EvidenceService } from "@modules/domain/decisions"
import type { Performed, PerformedBy, WorkContext, WorkItem } from "@modules/domain/decisions"
import type { CustomerDelivery, DeliveryContact, DeliveryCustomer } from "./work-performers.contracts"
import { PerformerKitService } from "./performer-kit.service"
import { leadHref } from "./performer.policy"

/** The conversation channel the website chat page reads itself: nothing is pushed. */
const WEBSITE_CHANNEL = "website"

/** The conversation channel of a Zalo OA customer. */
const ZALO_CHANNEL = "zalo"

/** What a conversation that could not be read or pushed counts as. */
const NOT_PUSHED: DeliveryResult = { delivered: false, failure: null }

@Injectable()
/**
 * Delivers the company's words to a customer with honest labels: stored in their conversation and pushed to the channel they are on;
 * when the customer has no conversation to answer in, nothing is sent and the record says so. A structured notice (a renewal) rides
 * along to the channel, so Zalo can reach the customer by ZNS outside its chat window.
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
        const sent = await this.toCustomer(ctx, customer, text)
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

    /** Delivers in the customer's latest conversation; without one nothing is sent and the summary says so. */
    async toCustomer(
        ctx: WorkContext,
        customer: DeliveryCustomer,
        text: string,
        notification?: RenewalNotification,
    ): Promise<CustomerDelivery> {
        const conversation = await this.conversations.latestOfLead(ctx.workspaceId, customer.id, null)
        if (conversation === null) {
            return { summary: this.kit.text(ctx, "recordedNoConversation", { channel: customer.channel }), real: false }
        }
        const sent = (await this.storeAndPush(ctx.workspaceId, conversation.id, text, notification)) ?? NOT_PUSHED
        if (conversation.channel === WEBSITE_CHANNEL) {
            return { summary: this.kit.text(ctx, "deliveredWebsite", { name: customer.contact_name }), real: true }
        }
        if (conversation.channel === ZALO_CHANNEL) {
            return { summary: this.zaloSummary(ctx, customer.contact_name, sent), real: sent.delivered }
        }
        const key = sent.delivered ? "deliveredTelegram" : "telegramFailed"
        return { summary: this.kit.text(ctx, key, { name: customer.contact_name }), real: sent.delivered }
    }

    /** Stores the message in the conversation and pushes it to the customer's channel; true when the channel accepted it. */
    async inConversation(
        workspaceId: string,
        conversationId: string,
        text: string,
        notification?: RenewalNotification,
    ): Promise<boolean> {
        const sent = await this.storeAndPush(workspaceId, conversationId, text, notification)
        return sent?.delivered ?? false
    }

    /** Stores the approved answer once with the deciding member's name and records its real delivery outcome. */
    async approvedInConversation(
        workspaceId: string,
        conversationId: string,
        text: string,
        memberName: string,
        workItemId: string,
        notification?: RenewalNotification,
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
        return (await this.channels.deliver(this.requestOf(conversationId, messageId, text, notification))).delivered
    }

    /** Stores the agent message and pushes it; null when the conversation cannot be read or is a website chat (nothing is pushed). */
    private async storeAndPush(
        workspaceId: string,
        conversationId: string,
        text: string,
        notification: RenewalNotification | undefined,
    ): Promise<DeliveryResult | null> {
        const messageId = await this.messages.storeAgentMessage(workspaceId, conversationId, text)
        const target = await this.conversations.targetOf(conversationId)
        if (target.kind !== "ok" || target.value.channel === WEBSITE_CHANNEL) return null
        return this.channels.deliver(this.requestOf(conversationId, messageId, text, notification))
    }

    private requestOf(
        conversationId: string,
        messageId: string,
        text: string,
        notification: RenewalNotification | undefined,
    ): DeliveryRequest {
        return notification === undefined
            ? { conversationId, messageId, text }
            : { conversationId, messageId, text, notification }
    }

    /** One honest line about a Zalo push: the route it took, a QR that did not follow, or why it did not go out. */
    private zaloSummary(ctx: WorkContext, name: string, sent: DeliveryResult): string {
        if (sent.delivered && sent.via === "zns") return this.kit.text(ctx, "deliveredZaloZns", { name })
        if (sent.delivered && sent.note === "qr_image_failed") return this.kit.text(ctx, "deliveredZaloNoQr", { name })
        if (sent.delivered) return this.kit.text(ctx, "deliveredZalo", { name })
        const reasons = [this.kit.text(ctx, `zaloFailure.${sent.failure ?? "zalo_error"}`)]
        if (sent.note !== undefined) reasons.push(this.kit.text(ctx, `zaloNote.${sent.note}`))
        return this.kit.text(ctx, "zaloFailed", { name, reason: reasons.join(" ") })
    }
}
