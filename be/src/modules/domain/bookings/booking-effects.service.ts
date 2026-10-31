import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BookingRemindersService } from "@modules/domain/booking-reminders"
import { BookingResourcesReadService } from "@modules/domain/booking-resources"
import { BookingServicesReadService } from "@modules/domain/booking-services"
import { EventsService } from "@modules/domain/events"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { BookingModelService } from "./booking-model.service"
import { BookingNoticesService } from "./booking-notices.service"
import type { BookingNotifier } from "./booking-notice.contracts"
import type { BookingEffects, BookingEvent, BookingSettings, InboxClaim } from "./bookings.contracts"
import { InjectBookingNotifier } from "./bookings.decorators"
import { EFFECTS_COLUMNS, EFFECTS_WHERE } from "./booking-effects.rows"
import type { EffectsBaseFacts, EffectsRow } from "./booking-facts.contracts"
import { BookingEntity } from "./persistence/entities"
import { feeOf, namedEffects, noticeMark, noticeOf, remindersOf } from "./policies/booking-effects.policy"
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
 * What a change of a booking sets going that only the back end does. The change itself (a desk click, a customer's request, a chat) is a plain write whose
 * trigger publishes `booking_status_changed` in the same transaction; this is the `booking_effects` reactor. The delivery is claimed in the inbox in the
 * transaction of the effects and the notice keeps its own mark, so a message delivered twice changes nothing twice and a notice that failed is tried again:
 * reminders are planned for a live booking and stopped for a closed one, the fee of a late cancellation or a no-show is recorded, a finished booking with a
 * price goes to the order chain, the evidence log gets its line and the customer is told in the chat the booking came from.
 */
export class BookingEffectsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectBookingNotifier() private readonly notifier: BookingNotifier,
        private readonly models: BookingModelService,
        private readonly notices: BookingNoticesService,
        private readonly reminders: BookingRemindersService,
        private readonly events: EventsService,
        private readonly inbound: InboundEventsService,
        private readonly servicesRead: BookingServicesReadService,
        private readonly resourcesRead: BookingResourcesReadService,
    ) {}

    /**
     * Applies the effects of one booking event, reading the booking as it is now under its row lock. The reminders, the fee, the order
     * hand-off and the evidence line run once per delivery key; the notice to the customer, which comes last with the fee it states, is
     * taken with its own mark on the booking, so a delivery whose notice failed after the effects committed sends it on the retry.
     */
    async apply(event: BookingEvent, claim: InboxClaim): Promise<BookingEffects> {
        if (event.workspaceId === "" || event.bookingId === "") return NO_EFFECTS
        const settings = await this.models.settings(event.workspaceId)
        const applied = await this.entityManager.transaction((manager) =>
            this.inTransaction(manager, event, settings, claim),
        )
        if (applied === null) return NO_EFFECTS
        const notified = await this.tell(event, applied.row, settings, applied.effects.feeVnd)
        return { ...applied.effects, notified }
    }

    private async inTransaction(
        manager: EntityManager,
        event: BookingEvent,
        settings: BookingSettings,
        claim: InboxClaim,
    ): Promise<Applied | null> {
        const base = await this.lockedBase(manager, event)
        if (base === undefined) return null
        const row = await this.named(base)
        if (row === null) return null
        if (!(await this.inbox.claim(claim.consumer, claim.dedupeKey, manager))) {
            // A delivery this reactor already applied: nothing changes twice, the notice still has its own mark.
            return {
                row,
                effects: { found: true, reminders: "none", feeVnd: row.cancel_fee_vnd, handedOff: false },
            }
        }
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

    /** The booking as the table holds it now, under a write lock on its row. */
    private lockedBase(manager: EntityManager, event: BookingEvent): Promise<EffectsBaseFacts | undefined> {
        return manager
            .createQueryBuilder(BookingEntity, "b")
            .select(EFFECTS_COLUMNS)
            .where(EFFECTS_WHERE, { workspaceId: event.workspaceId, bookingId: event.bookingId })
            .limit(1)
            .setLock("pessimistic_write", undefined, ["b"])
            .getRawOne<EffectsBaseFacts>()
    }

    /** The booking with the current names of its service and resource; none when its service is gone. */
    private async named(base: EffectsBaseFacts): Promise<EffectsRow | null> {
        const [serviceNames, resourceNames] = await Promise.all([
            this.servicesRead.namesOf(base.workspace_id, [base.service_id]),
            this.resourcesRead.namesOf(base.workspace_id, [base.resource_id]),
        ])
        return namedEffects(base, serviceNames, resourceNames)
    }

    private async recordFee(
        manager: EntityManager,
        event: BookingEvent,
        row: EffectsRow,
        settings: BookingSettings,
    ): Promise<number> {
        const fee = feeOf(row, settings)
        if (fee <= 0) return row.cancel_fee_vnd
        const set = await manager
            .createQueryBuilder(BookingEntity, "bo")
            .update()
            .set({ cancelFeeVnd: String(fee) })
            .where({ workspaceId: event.workspaceId, id: event.bookingId, cancelFeeVnd: "0" })
            .returning("id")
            .execute()
        return Array.isArray(set.raw) && set.raw.length > 0 ? fee : row.cancel_fee_vnd
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
        const first = await this.claim(manager, event, `evidence:${row.status}`)
        if (!first) return
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
        const claimed = await this.claim(this.entityManager, event, mark)
        if (!claimed) return false
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
            if (!kept) await this.release(event, mark)
        }
    }

    /** Takes a mark on a booking once: true the first time and false after, in one statement. */
    private async claim(manager: EntityManager, event: BookingEvent, mark: string): Promise<boolean> {
        const claimed = await manager
            .createQueryBuilder(BookingEntity, "bo")
            .update()
            .set({ effects: () => "effects || jsonb_build_object(CAST(:mark AS text), true)" })
            .where({ workspaceId: event.workspaceId, id: event.bookingId })
            .andWhere("NOT (effects ? CAST(:mark AS text))")
            .setParameter("mark", mark)
            .returning("id")
            .execute()
        return Array.isArray(claimed.raw) && claimed.raw.length > 0
    }

    /** Gives a mark back, so a notice that did not reach the customer is tried again. */
    private async release(event: BookingEvent, mark: string): Promise<void> {
        await this.entityManager
            .createQueryBuilder(BookingEntity, "bo")
            .update()
            .set({ effects: () => "effects - CAST(:mark AS text)" })
            .where({ workspaceId: event.workspaceId, id: event.bookingId })
            .setParameter("mark", mark)
            .execute()
    }
}
