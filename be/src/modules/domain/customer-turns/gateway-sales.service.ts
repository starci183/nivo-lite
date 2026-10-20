import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { formatVnd, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { GatewayCaller, GatewayCallResult, JsonObject } from "@modules/domain/mcp-gateway"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HOTEL_CONNECTOR, GatewayContextService } from "./gateway-context.service"
import type { HotelRequest } from "./gateway-turns.contracts"
import {
    clockOf,
    customerIdOf,
    guestIdOf,
    nightlyOf,
    numberAt,
    roomLabelsOf,
    roomsOf,
    slotAt,
    slotsOf,
    slotTimesOf,
    textAt,
} from "./gateway-reply.policy"
import { HubNotesService } from "./hub-notes.service"
import { UPSERT_IDENTITY_LINK } from "./persistence/gateway-turns.sql"

const LOCALE = "vi"

/** What one hotel request came to: the reply that replaces the chat's own, and the lines to show. */
export interface GatewayOutcome {
    /** The reply. */
    readonly reply: string
    /** The workbench lines. */
    readonly lines: ReadonlyArray<string>
}

/** The approval a gated call becomes: what to replay and what to tell the guest once approved. */
export interface GatedCall {
    /** The full tool name. */
    readonly tool: string
    /** The exact arguments. */
    readonly args: JsonObject
    /** The guest's name. */
    readonly name: string
    /** The reply once performed. */
    readonly replyOk: string
    /** Why it needs a person. */
    readonly reason: string
}

/** The action of a gated call's approval. */
export const GATEWAY_CALL_ACTION = "gateway_call"

@Injectable()
/**
 * The Sales side of a hotel turn (AI Sales & Đặt chỗ on Zalo): after the AI step named a `hotel_request`, NIVO itself calls HAKUEN
 * through the gateway (free spa slots, rooms and rates, holds, confirmation) and answers with what HAKUEN confirmed. A hold waits for
 * the guest's name. A discount over the agent's `limit_pct` becomes an approval in the Sales room; the guest hears it was asked. When
 * HAKUEN does not answer, the guest gets the holding line and a person gets the question: a hold is never claimed unconfirmed.
 */
export class GatewaySalesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly gateway: McpGatewayService,
        private readonly context: GatewayContextService,
        private readonly notes: HubNotesService,
        private readonly engine: WorkEngineService,
    ) {}

    /** Runs one hotel request of a turn. */
    async settle(
        ctx: WorkContext,
        conversation: TurnConversation,
        messageId: string,
        request: HotelRequest,
    ): Promise<GatewayOutcome> {
        const caller = this.context.callerOf(conversation)
        const outcome = await this.run(ctx, conversation, caller, messageId, request)
        if (outcome !== null) return outcome
        await this.askPerson(ctx, conversation, messageId)
        return { reply: this.text("gatewayTurns.holding"), lines: [] }
    }

    /** The outcome, or null when HAKUEN did not answer and the holding line must go out. */
    private async run(
        ctx: WorkContext,
        conversation: TurnConversation,
        caller: GatewayCaller,
        messageId: string,
        request: HotelRequest,
    ): Promise<GatewayOutcome | null> {
        if (request.intent === "spa_slots") return this.spaSlots(caller, request)
        if (request.intent === "room_search") return this.roomSearch(caller, request)
        if (request.name === "") return { reply: this.text("gatewayTurns.askName"), lines: [] }
        const guestId = await this.guestOf(conversation, caller, request)
        if (guestId === null) return null
        return request.intent === "spa_hold"
            ? this.spaHold(conversation, caller, request, guestId)
            : this.roomHold(ctx, conversation, caller, messageId, request, guestId)
    }

    private async spaSlots(caller: GatewayCaller, request: HotelRequest): Promise<GatewayOutcome | null> {
        const found = await this.findSlots(caller, request)
        if (!found.ok) return null
        const slots = slotsOf(found.value)
        if (slots.length === 0) return { reply: this.text("gatewayTurns.noSlot"), lines: [] }
        return { reply: this.text("gatewayTurns.slots", { slots: slotTimesOf(slots) }), lines: [] }
    }

    private async spaHold(
        conversation: TurnConversation,
        caller: GatewayCaller,
        request: HotelRequest,
        guestId: string,
    ): Promise<GatewayOutcome | null> {
        const found = await this.findSlots(caller, request)
        if (!found.ok) return null
        const slot = slotAt(slotsOf(found.value), request.time)
        if (slot === null) return { reply: this.text("gatewayTurns.noSlot"), lines: [] }
        const held = await this.gateway.call(caller, "hakuen.spa.hold", {
            slotId: slot.slotId,
            guestId,
            partySize: request.partySize,
        })
        if (!held.ok) return null
        const date = request.date ?? ""
        const params = {
            service: request.service,
            party: String(request.partySize),
            time: slot.time,
            date,
            name: request.name,
            expires: clockOf(textAt(held.value, "expiresAt")),
        }
        await this.postHeld(conversation, request.name, `${request.service} · ${String(request.partySize)}`, {
            when: `${slot.time} ${date}`.trim(),
            expires: params.expires,
        })
        this.context.forget(conversation)
        return { reply: this.text("gatewayTurns.spaHeld", params), lines: [this.text("gatewayTurns.cardHeld")] }
    }

    private async roomSearch(caller: GatewayCaller, request: HotelRequest): Promise<GatewayOutcome | null> {
        const searched = await this.gateway.call(caller, "hakuen.rooms.searchAvailability", {
            checkIn: request.date,
            nights: request.nights,
            guests: request.partySize,
            ...(request.roomType === "" ? {} : { roomType: request.roomType }),
        })
        if (!searched.ok) return null
        const rooms = roomsOf(searched.value)
        const first = rooms[0]
        if (first === undefined) return { reply: this.text("gatewayTurns.noRoom"), lines: [] }
        const quoted = await this.gateway.call(caller, "hakuen.rates.quote", {
            roomType: first.roomType,
            checkIn: request.date,
            nights: request.nights,
            guests: request.partySize,
        })
        const quote = quoted.ok ? this.quoteOf(quoted.value, first.roomType, request.nights) : ""
        const reply = [this.text("gatewayTurns.rooms", { rooms: roomLabelsOf(rooms) }), quote].filter(
            (part) => part !== "",
        )
        return { reply: reply.join(" "), lines: [] }
    }

    private async roomHold(
        ctx: WorkContext,
        conversation: TurnConversation,
        caller: GatewayCaller,
        messageId: string,
        request: HotelRequest,
        guestId: string,
    ): Promise<GatewayOutcome | null> {
        const held = await this.gateway.call(caller, "hakuen.booking.hold", {
            roomType: request.roomType,
            checkIn: request.date,
            nights: request.nights,
            guestId,
        })
        if (!held.ok) return null
        const holdId = textAt(held.value, "holdId")
        const date = request.date ?? ""
        const params = {
            roomType: request.roomType,
            nights: String(request.nights),
            date,
            name: request.name,
            expires: clockOf(textAt(held.value, "expiresAt")),
        }
        await this.postHeld(conversation, request.name, `${request.roomType} · ${params.nights}`, {
            when: date,
            expires: params.expires,
        })
        this.context.forget(conversation)
        const heldReply = this.text("gatewayTurns.roomHeld", params)
        if (request.discountPct === null) return { reply: heldReply, lines: [this.text("gatewayTurns.cardHeld")] }
        const args = { holdId, discountPct: request.discountPct }
        const confirmed = await this.gateway.call(caller, "hakuen.booking.confirm", args)
        const pct = String(request.discountPct)
        if (!confirmed.ok && confirmed.code === "approval_required") {
            await this.gate(ctx, conversation, messageId, {
                tool: "hakuen.booking.confirm",
                args,
                name: request.name,
                replyOk: this.text("gatewayTurns.discountApproved", { pct }),
                reason: confirmed.reason,
            })
            return {
                reply: `${heldReply} ${this.text("gatewayTurns.discountAsked", { pct })}`,
                lines: [this.text("gatewayTurns.cardApproval")],
            }
        }
        if (!confirmed.ok) return null
        const bookingId = textAt(confirmed.value, "bookingId")
        return { reply: this.text("gatewayTurns.roomConfirmed", { name: request.name, bookingId }), lines: [] }
    }

    /** Opens the approval of a gated call in the agent's room; the performer replays it once a person approves. */
    async gate(ctx: WorkContext, conversation: TurnConversation, messageId: string, call: GatedCall): Promise<void> {
        await this.engine.runWork(ctx, {
            action: GATEWAY_CALL_ACTION,
            subject_type: "conversation",
            subject_id: conversation.id,
            lead_id: conversation.leadId,
            origin: "live",
            preset: true,
            noChain: true,
            forceAsk: "over_authority",
            dedupeKey: `${GATEWAY_CALL_ACTION}:${call.tool}:message:${messageId}`,
            seed: {
                summary: this.text("gatewayTurns.approvalSummary", {
                    tool: call.tool,
                    name: call.name,
                    reason: call.reason,
                }),
                draft: call.replyOk,
                fields: {
                    tool: call.tool,
                    args_json: JSON.stringify(call.args),
                    customer: call.name,
                    discount_pct: typeof call.args.discountPct === "number" ? call.args.discountPct : null,
                    conversation_id: conversation.id,
                    agent_id: conversation.agent.id,
                    reason: call.reason,
                    sources: this.text("gatewayTurns.sources"),
                },
            },
        })
    }

    /** HAKUEN's guest of the conversation, created or updated with the name the guest gave; linked on NIVO's side. */
    private async guestOf(
        conversation: TurnConversation,
        caller: GatewayCaller,
        request: HotelRequest,
    ): Promise<string | null> {
        const externalId = customerIdOf(conversation.externalId ?? conversation.id)
        const upserted = await this.gateway.call(caller, "hakuen.guest.upsertByChannelIdentity", {
            channel: conversation.channel,
            externalId,
            name: request.name,
            ...(request.phone === null ? {} : { phone: request.phone }),
        })
        const guestId = upserted.ok ? guestIdOf(upserted.value) : null
        if (guestId === null) return null
        await this.entityManager.query(UPSERT_IDENTITY_LINK, [
            conversation.workspaceId,
            HOTEL_CONNECTOR,
            conversation.channel,
            externalId,
            conversation.leadId,
            guestId,
        ])
        return guestId
    }

    private findSlots(caller: GatewayCaller, request: HotelRequest): Promise<GatewayCallResult> {
        return this.gateway.call(caller, "hakuen.spa.findSlots", {
            service: request.service,
            date: request.date,
            partySize: request.partySize,
            ...(request.time === null ? {} : { after: request.time }),
        })
    }

    private quoteOf(value: JsonObject, roomType: string, nights: number): string {
        const nightly = nightlyOf(value)
        const total = numberAt(value, "totalVnd")
        if (nightly === null || total === null) return ""
        return this.text("gatewayTurns.quote", {
            roomType,
            nightly: formatVnd(nightly, LOCALE),
            total: formatVnd(total, LOCALE),
            nights: String(nights),
        })
    }

    private async postHeld(
        conversation: TurnConversation,
        name: string,
        what: string,
        held: { readonly when: string; readonly expires: string },
    ): Promise<void> {
        await this.notes.post(
            {
                workspaceId: conversation.workspaceId,
                room: "sales",
                type: "booking_held",
                title: this.text("gatewayTurns.cardHeld"),
                fields: [
                    { label: this.text("gatewayTurns.field.guest"), value: name },
                    { label: this.text("gatewayTurns.field.service"), value: what },
                    { label: this.text("gatewayTurns.field.time"), value: held.when },
                    { label: this.text("gatewayTurns.field.expires"), value: held.expires },
                    { label: this.text("gatewayTurns.field.sources"), value: this.text("gatewayTurns.sources") },
                ],
                authorName: conversation.agent.name,
            },
            conversation.agent.id,
            { leadId: conversation.leadId, workItemId: null },
        )
    }

    /** HAKUEN did not answer: a person gets the guest's question (`reply_customer`, unclear outcome). */
    private async askPerson(ctx: WorkContext, conversation: TurnConversation, messageId: string): Promise<void> {
        await this.engine.runWork(ctx, {
            action: "reply_customer",
            subject_type: "conversation",
            subject_id: conversation.id,
            lead_id: conversation.leadId,
            origin: "live",
            preset: true,
            noChain: true,
            forceAsk: "unclear_outcome",
            dedupeKey: `reply_customer:hotel:message:${messageId}`,
            seed: {
                summary: this.text("gatewayTurns.holding"),
                fields: { conversation_id: conversation.id, source: HOTEL_CONNECTOR },
            },
        })
    }

    private text(key: string, params: Readonly<Record<string, string>> = {}): string {
        return this.catalog.get(key, params, LOCALE)
    }
}
