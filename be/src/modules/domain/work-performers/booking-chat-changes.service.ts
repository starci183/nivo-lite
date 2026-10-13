import { Injectable } from "@nestjs/common"
import { BookingChatLookupService, BookingPublicService, bookingIsoOf, zonedMs } from "@modules/domain/bookings"
import type { OptionalCancellableBooking } from "@modules/domain/bookings"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { BookingChatAnswer, BookingChatTurn } from "./booking-chat.contracts"

const LOCALE = "vi"
const ENGINE_ACTOR = "NIVO engine"

@Injectable()
/**
 * A customer's change of an appointment from the chat: the next open booking (through the chat's lead or conversation, else the phone the
 * customer gave) gets a cancellation decision the owner takes, or a move to the time asked through the owner's rule. Nothing moves or
 * cancels here: the booking performer does once the gate lets it through.
 */
export class BookingChatChangesService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly bookings: BookingPublicService,
        private readonly lookup: BookingChatLookupService,
        private readonly engine: WorkEngineService,
    ) {}

    /** Opens the cancellation or the move of the customer's next booking as a decision of the owner's gate. */
    async apply(turn: BookingChatTurn): Promise<BookingChatAnswer> {
        const { request } = turn
        const nowMs = this.clock.now().getTime()
        const next = await this.nextOf(turn, nowMs)
        if (next === null) return this.say("notFound")
        const ctx: WorkContext = { workspaceId: turn.workspaceId, actor: ENGINE_ACTOR, locale: LOCALE }
        const fields = {
            booking_id: next.id,
            start_at: next.startIso,
            service: next.serviceName,
            customer_name: next.customerName,
            conversation_id: turn.conversationId,
        }
        const subject = {
            subject_type: "conversation" as const,
            subject_id: turn.conversationId,
            lead_id: next.leadId ?? turn.leadId,
        }
        if (request.intent === "cancel") {
            await this.engine.runWork(ctx, {
                action: "cancel_booking",
                ...subject,
                origin: "live",
                preset: true,
                noChain: true,
                forceAsk: "unclear_outcome",
                dedupeKey: `cancel_booking:booking:${next.id}`,
                seed: {
                    summary: this.text("cancelSummary", {
                        service: next.serviceName,
                        name: next.customerName,
                        start: next.startIso,
                    }),
                    fields: { ...fields, reason: request.note ?? "" },
                },
            })
            return this.say("cancelWaiting", { service: next.serviceName })
        }
        if (request.date === null || request.time === null) return this.say("askNewTime", { service: next.serviceName })
        const catalog = await this.bookings.catalogIn(turn.workspaceId)
        const newStart = bookingIsoOf(zonedMs(request.date, request.time, catalog.timezone))
        await this.engine.runWork(ctx, {
            action: "reschedule",
            ...subject,
            origin: "live",
            preset: true,
            noChain: true,
            dedupeKey: `reschedule:booking:${next.id}:${newStart}`,
            seed: {
                summary: this.text("rescheduleSummary", {
                    service: next.serviceName,
                    name: next.customerName,
                    start: next.startIso,
                    to: newStart,
                }),
                fields: { ...fields, new_start: newStart },
            },
        })
        return { reply: null, state: "reschedule_asked" }
    }

    /** The customer's next open booking: through the chat (its lead, its conversation), else the phone the customer gave. */
    private async nextOf(turn: BookingChatTurn, nowMs: number): Promise<OptionalCancellableBooking> {
        const chat = await this.lookup.nextOfChat(
            { workspaceId: turn.workspaceId, leadId: turn.leadId, conversationId: turn.conversationId },
            nowMs,
        )
        if (chat !== null || turn.request.phone === null) return chat
        return this.bookings.nextCancellable(turn.workspaceId, turn.request.phone, nowMs)
    }

    private say(key: string, params: Readonly<Record<string, string>> = {}): BookingChatAnswer {
        return { reply: this.text(key, params), state: key }
    }

    private text(key: string, params: Readonly<Record<string, string>> = {}): string {
        return this.catalog.get(`performers.chatBooking.${key}`, params, LOCALE)
    }
}
