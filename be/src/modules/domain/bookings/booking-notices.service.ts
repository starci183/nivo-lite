import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { effectsQuery } from "./booking-effects.query"
import type { EffectsRow } from "./booking-facts.contracts"
import { BookingModelService } from "./booking-model.service"
import type { BookingNotice, BookingNoticeKind, BookingNoticeResult, BookingNotifier } from "./booking-notice.contracts"
import type { BookingSettings } from "./bookings.contracts"
import { InjectBookingNotifier } from "./bookings.decorators"
import {
    REMINDER_NEUTRAL,
    cancelledText,
    confirmedText,
    fillReminderBody,
    movedText,
    noShowText,
    reminderText,
    reminderVariables,
    whenText,
} from "./policies/booking-notice-text.policy"
import type { NoticeFacts, Say } from "./policies/booking-notice-text.policy"

/** A booking of a workspace, or null when there is none. */
export type OptionalBooking = EffectsRow | null

/** The wording the owner set for the reminder, or null for the fixed one. */
export type OptionalBody = string | null

const STORED_LOCALE = "vi"
/** The shop name a notice carries when the workspace has none. */
const DEFAULT_SHOP = "NIVO"

/** The kinds of notice that a booking change writes (a reminder has its own writer). */
type ChangeNotice = Exclude<BookingNoticeKind, "reminder">

@Injectable()
/** The facts of a booking and the fixed Vietnamese sentences a customer is sent about it: confirmed, moved, cancelled, no-show and reminded. */
export class BookingNoticesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly models: BookingModelService,
        private readonly workspaces: WorkspacesService,
        @InjectBookingNotifier() private readonly notifier: BookingNotifier,
    ) {}

    /** The booking as a notice needs it (not locked), or null when it does not exist in the workspace. */
    async bookingOf(workspaceId: string, bookingId: string): Promise<OptionalBooking> {
        const row = await effectsQuery(this.entityManager, workspaceId, bookingId).getRawOne<EffectsRow>()
        return row ?? null
    }

    /** What a notice says about the booking, with the fee the booking owes now. */
    async factsOf(
        workspaceId: string,
        row: EffectsRow,
        settings: BookingSettings,
        feeVnd: number,
    ): Promise<NoticeFacts> {
        const shop = (await this.workspaces.nameOf(workspaceId)).trim()
        return {
            shop: shop === "" ? DEFAULT_SHOP : shop,
            customer: row.customer_name,
            service: row.service_name,
            resource: row.resource_name,
            startMs: row.start_ms,
            timezone: settings.timezone,
            address: settings.address,
            depositVnd: row.deposit_vnd,
            cancelWindowHours: settings.cancelWindowHours,
            fromMs: row.from_ms,
            feeVnd,
        }
    }

    /** The sentence for a change of the booking. */
    textOf(kind: ChangeNotice, facts: NoticeFacts): string {
        const t = this.say()
        if (kind === "confirmed") return confirmedText(t, facts)
        if (kind === "moved") return movedText(t, facts)
        return kind === "cancelled" ? cancelledText(t, facts) : noShowText(t, facts)
    }

    /** The subject of the email that carries a notice. */
    subjectOf(kind: BookingNoticeKind, service: string): string {
        const t = this.say()
        return t(`bookings.subject.${kind}`, { service })
    }

    /** The reminder: the owner's own wording with its blanks filled, or the fixed sentence. */
    reminderOf(facts: NoticeFacts, hoursBefore: number, customBody: OptionalBody): string {
        const t = this.say()
        if (customBody === null || customBody.trim() === "") return reminderText(t, facts, hoursBefore)
        const neutral = Object.fromEntries(REMINDER_NEUTRAL.map((name) => [name, t(`bookings.neutral.${name}`)]))
        return fillReminderBody(customBody, reminderVariables(t, facts), neutral)
    }

    /** Delivers a notice to the customer through the notifier the app registered. */
    deliver(notice: BookingNotice): Promise<BookingNoticeResult> {
        return this.notifier.notify(notice)
    }

    /** An instant as the customer reads it. */
    whenOf(ms: number, timezone: string): string {
        return whenText(this.say(), ms, timezone)
    }

    /** The settings of the workspace the sentences read. */
    settingsOf(workspaceId: string): Promise<BookingSettings> {
        return this.models.settings(workspaceId)
    }

    private say(): Say {
        return (key, params = {}) => this.catalog.get(key, params, STORED_LOCALE)
    }
}
