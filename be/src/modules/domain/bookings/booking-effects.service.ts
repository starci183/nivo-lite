import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BookingRemindersService } from "@modules/domain/booking-reminders"
import { EventsService } from "@modules/domain/events"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { BookingModelService } from "./booking-model.service"
import { BookingNoticesService } from "./booking-notices.service"
import type { BookingNotifier } from "./booking-notice.contracts"
import type { BookingEffects, BookingEvent, BookingSettings } from "./bookings.contracts"
import { InjectBookingNotifier } from "./bookings.decorators"
import {
    CLAIM_EFFECT,
    RELEASE_EFFECT,
    SELECT_BOOKING_FOR_EFFECTS,
    SET_BOOKING_FEE,
} from "./persistence/booking-effects.sql"
import type { EffectsRow } from "./persistence/booking.rows"
import { feeOf, noticeMark, noticeOf, remindersOf } from "./policies/booking-effects.policy"
import type { NoticeKind } from "./policies/booking-effects.policy"

const STORED_LOCALE = "vi"
const NO_EFFECTS: BookingEffects = { found: false, reminders: "none", feeVnd: 0, handedOff: false, notified: false }

/** What the transaction decided, for the steps that follow it. */
interface Applied {
    readonly row: EffectsRow
    readonly effects: Omit<BookingEffects, "notified">
}

@Injectable()
/**
 * What a change of a booking sets going that only the back end does. The change itself (a desk click, a customer's request, a chat) is a plain write the
 * database sends here on the booking_status queue; each effect is taken once with a mark on the booking, so a message delivered twice changes nothing twice:
 * reminders are planned for a live booking and stopped for a closed one, the fee of a late cancellation or a no-show is recorded, a finished booking with a
 * price goes to the order chain, the evidence log gets its line and the customer is told in the chat the booking came from.
 */
export class BookingEffectsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        @InjectBookingNotifier() private readonly notifier: BookingNotifier,
        private readonly models: BookingModelService,
        private readonly notices: BookingNoticesService,
        private readonly reminders: BookingRemindersService,
        private readonly events: EventsService,
        private readonly inbound: InboundEventsService,
    ) {}

    /** Applies the effects of one booking event. */
    async apply(event: BookingEvent): Promise<BookingEffects> {
        if (event.workspaceId === "" || event.bookingId === "") return NO_EFFECTS
        const settings = await this.models.settings(event.workspaceId)
        const applied = await this.entityManager.transaction((manager) => this.inTransaction(manager, event, settings))
        if (applied === null) return NO_EFFECTS
        const notified = await this.tell(event, applied.row, settings, applied.effects.feeVnd)
        return { ...applied.effects, notified }
    }

    private async inTransaction(
        manager: EntityManager,
        event: BookingEvent,
        settings: BookingSettings,
    ): Promise<Applied | null> {
        const [row] = await manager.query<Array<EffectsRow>>(SELECT_BOOKING_FOR_EFFECTS, [
            event.workspaceId,
            event.bookingId,
        ])
        if (row === undefined) return null
        const nowMs = this.clock.now().getTime()
        const live = row.status === "confirmed" || row.status === "rescheduled"
        const closed = row.status === "done" || row.status === "no_show" || row.status === "cancelled"
        if (live) {
            await this.reminders.schedule({
                manager,
                workspaceId: event.workspaceId,
                bookingId: event.bookingId,
                startMs: row.start_ms,
                nowMs,
                defaultHours: settings.reminderHours,
            })
        }
        if (closed) await this.reminders.cancel(manager, event.bookingId, `booking_${row.status}`)
        const feeVnd = closed ? await this.recordFee(manager, event, row, settings) : 0
        const handedOff = row.status === "done" && (await this.handOff(manager, event, row, settings))
        if (closed) await this.logEvidence(manager, event, row)
        return {
            row,
            effects: { found: true, reminders: remindersOf(live, closed), feeVnd, handedOff },
        }
    }

    private async recordFee(
        manager: EntityManager,
        event: BookingEvent,
        row: EffectsRow,
        settings: BookingSettings,
    ): Promise<number> {
        const fee = feeOf(row, settings)
        if (fee <= 0) return row.cancel_fee_vnd
        const set = await manager.query<Array<{ id: string }>>(SET_BOOKING_FEE, [
            event.workspaceId,
            event.bookingId,
            fee,
        ])
        return set.length > 0 ? fee : row.cancel_fee_vnd
    }

    private handOff(
        manager: EntityManager,
        event: BookingEvent,
        row: EffectsRow,
        settings: BookingSettings,
    ): Promise<boolean> {
        if (!settings.handoffOrder || row.price_vnd === null || row.price_vnd <= 0) return Promise.resolve(false)
        return this.inbound.handOffOrder(
            {
                workspaceId: event.workspaceId,
                origin: row.origin,
                sender: row.customer_name,
                contact: row.customer_phone ?? row.customer_email,
                body: this.messages.get("bookings.handoff.body", { service: row.service_name }, STORED_LOCALE),
                amountVnd: row.price_vnd,
                ref: event.bookingId,
                leadId: row.lead_id,
            },
            manager,
        )
    }

    private async logEvidence(manager: EntityManager, event: BookingEvent, row: EffectsRow): Promise<void> {
        const first = await manager.query<Array<{ id: string }>>(CLAIM_EFFECT, [
            event.workspaceId,
            event.bookingId,
            `evidence:${row.status}`,
        ])
        if (first.length === 0) return
        await this.events.record(
            {
                workspaceId: event.workspaceId,
                kind: `booking.${row.status}`,
                actor: this.messages.get("bookings.evidence.actor", {}, STORED_LOCALE),
                summary: this.messages.get(
                    `bookings.evidence.${row.status}`,
                    { service: row.service_name, customer: row.customer_name },
                    STORED_LOCALE,
                ),
                leadId: row.lead_id,
            },
            manager,
        )
    }

    private async tell(
        event: BookingEvent,
        row: EffectsRow,
        settings: BookingSettings,
        feeVnd: number,
    ): Promise<boolean> {
        const notice: NoticeKind | null = noticeOf(event.kind, row.status)
        if (notice === null) return false
        const mark = noticeMark(notice, row.reschedule_count)
        const claimed = await this.entityManager.query<Array<{ id: string }>>(CLAIM_EFFECT, [
            event.workspaceId,
            event.bookingId,
            mark,
        ])
        if (claimed.length === 0) return false
        let kept = false
        try {
            const facts = await this.notices.factsOf(event.workspaceId, row, settings, feeVnd)
            const result = await this.notifier.notify({
                workspaceId: event.workspaceId,
                bookingId: event.bookingId,
                kind: notice,
                leadId: row.lead_id,
                conversationId: row.conversation_id,
                email: row.customer_email,
                subject: this.notices.subjectOf(notice, row.service_name),
                text: this.notices.textOf(notice, facts),
                dedupeKey: `${event.bookingId}:${mark}`,
            })
            kept = result.kept
            return result.delivered
        } finally {
            if (!kept) await this.entityManager.query(RELEASE_EFFECT, [event.workspaceId, event.bookingId, mark])
        }
    }
}
