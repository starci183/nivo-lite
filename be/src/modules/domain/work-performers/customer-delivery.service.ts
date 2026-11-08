import { Injectable } from "@nestjs/common"
import {
    ChannelDeliveryService,
    type DeliveryOutcome,
    type DeliveryRequest,
    type DeliveryResult,
    type RenewalNotification,
} from "@modules/domain/channels"
import {
    ChatConversationsService,
    ChatMessagesService,
    type ChatConversationTarget,
    type HumanAuthor,
} from "@modules/domain/chat-records"
import {
    EvidenceService,
    type Performed,
    type PerformedBy,
    type WorkContext,
    type WorkItem,
} from "@modules/domain/decisions"
import type {
    CustomerDelivery,
    DeliveryContact,
    DeliveryCustomer,
    OptionalContact,
    OptionalConversationId,
} from "./work-performers.contracts"
import { PerformerKitService } from "./performer-kit.service"
import { conversationIdOf, leadHref } from "./performer.policy"

/** The conversation channel the website chat page reads itself: nothing is pushed. */
const WEBSITE_CHANNEL = "website"

/** The conversation channel of a Zalo OA customer. */
const ZALO_CHANNEL = "zalo"

/** What a conversation that could not be read or pushed counts as. */
const NOT_PUSHED: DeliveryResult = { delivered: false, failure: null }

/** What a message already stored and delivered counts as. */
const ALREADY_PUSHED: DeliveryResult = { delivered: true, failure: null }

@Injectable()
/**
 * Delivers the company's words to a customer with honest labels: stored in their conversation and pushed to the channel they are on;
 * when no conversation is known to answer in, nothing is sent and the record says so. A structured notice (a renewal) rides along to
 * the channel, so Zalo can reach the customer by ZNS outside its chat window.
 */
export class CustomerDeliveryService {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly conversations: ChatConversationsService,
        private readonly messages: ChatMessagesService,
        private readonly channels: ChannelDeliveryService,
        private readonly evidence: EvidenceService,
    ) {}

    /** How the owner reaches the customer on the card: the phone, else the email, else nobody. */
    contactOf(lead: DeliveryContact): OptionalContact {
        return lead.phone ?? lead.email
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
        const conversationId = conversationIdOf(item, item.proposal.fields)
        const sent = await this.toCustomer(ctx, customer, conversationId, item.id, text)
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

    /** Delivers in the conversation the work names, once under the key; without one nothing is sent and the summary says so. */
    async toCustomer(
        ctx: WorkContext,
        customer: DeliveryCustomer,
        conversationId: OptionalConversationId,
        key: string,
        text: string,
        notification?: RenewalNotification,
    ): Promise<CustomerDelivery> {
        const target =
            conversationId === null ? null : await this.conversations.targetOf(ctx.workspaceId, conversationId)
        if (target?.kind !== "ok") {
            return { summary: this.kit.text(ctx, "recordedNoConversation", { channel: customer.channel }), real: false }
        }
        const sent = await this.storeAndPush(target.value, text, key, notification)
        if (target.value.channel === WEBSITE_CHANNEL) {
            return { summary: this.kit.text(ctx, "deliveredWebsite", { name: customer.contact_name }), real: true }
        }
        if (target.value.channel === ZALO_CHANNEL) {
            return { summary: this.zaloSummary(ctx, customer.contact_name, sent), real: sent.delivered }
        }
        const summaryKey = sent.delivered ? "deliveredTelegram" : "telegramFailed"
        return { summary: this.kit.text(ctx, summaryKey, { name: customer.contact_name }), real: sent.delivered }
    }

    /** Stores the message once under its key in the conversation and pushes it to the customer's channel; true when the channel accepted it. */
    async inConversation(
        workspaceId: string,
        conversationId: string,
        key: string,
        text: string,
        notification?: RenewalNotification,
    ): Promise<boolean> {
        const target = await this.conversations.targetOf(workspaceId, conversationId)
        if (target.kind !== "ok") return false
        return (await this.storeAndPush(target.value, text, key, notification)).delivered
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
        const target = await this.conversations.targetOf(workspaceId, conversationId)
        if (target.kind !== "ok") return false
        const human: HumanAuthor = { name: memberName, userId: null }
        return (await this.storeAndPush(target.value, text, workItemId, notification, human)).delivered
    }

    /** Stores the output's reply once and returns its acknowledged, refused or unresolved delivery fact. */
    async finalInConversation(
        workspaceId: string,
        conversationId: string,
        text: string,
        workItemId: string,
    ): Promise<DeliveryOutcome> {
        const target = await this.conversations.targetOf(workspaceId, conversationId)
        if (target.kind !== "ok") return "rejected"
        const stored = await this.messages.storeAgentLine({ workspaceId, conversationId, body: text, key: workItemId })
        if (stored.sent) return "acknowledged"
        const delivered = await this.channels.deliver({
            workspaceId,
            conversationId,
            messageId: stored.id,
            text: stored.body,
        })
        return delivered.outcome
    }

    /**
     * Stores the agent message once under its key and pushes it unless an earlier attempt already did; a website chat reads the stored
     * message itself, so nothing is pushed and it counts as not pushed.
     */
    private async storeAndPush(
        target: ChatConversationTarget,
        text: string,
        key: string,
        notification: RenewalNotification | undefined,
        human?: HumanAuthor,
    ): Promise<DeliveryResult> {
        const stored = await this.messages.storeAgentLine({
            workspaceId: target.workspaceId,
            conversationId: target.id,
            body: text,
            key,
            human,
        })
        if (target.channel === WEBSITE_CHANNEL) {
            if (!stored.sent) await this.messages.markDelivery(target.workspaceId, stored.id, true)
            return NOT_PUSHED
        }
        if (stored.sent) return ALREADY_PUSHED
        return this.channels.deliver(this.requestOf(target, stored.id, stored.body, notification))
    }

    private requestOf(
        target: ChatConversationTarget,
        messageId: string,
        text: string,
        notification: RenewalNotification | undefined,
    ): DeliveryRequest {
        const request = { workspaceId: target.workspaceId, conversationId: target.id, messageId, text }
        return notification === undefined ? request : { ...request, notification }
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
