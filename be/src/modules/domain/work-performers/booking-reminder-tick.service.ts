import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AutomationExtensionsService } from "@modules/domain/automations"
import { BookingRemindersService, hoursOfKind } from "@modules/domain/booking-reminders"
import type { DueReminder } from "@modules/domain/booking-reminders"
import { BookingNoticesService } from "@modules/domain/bookings"
import type { EffectsRow } from "@modules/domain/bookings"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { LIVE_BOOKING_STATUSES, contactOf, settlementOf } from "./booking-remind.policy"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

const LOCALE = "vi"
/** The most reminders one tick takes. */
const BATCH = 40
const NOTE_MAX = 300

@Injectable()
/**
 * The minute tick of the booking reminders. It turns the reminder rows that are due into `remind_booking` work items and the owner's
 * authority gate decides (the default is to send by itself); the row records what happened. Rows are taken once, so two ticks never
 * remind twice, and a reminder whose booking closed or started is skipped. It never talks to a customer directly.
 */
export class BookingReminderTickService implements OnModuleInit {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly extensions: AutomationExtensionsService,
        private readonly reminders: BookingRemindersService,
        private readonly notices: BookingNoticesService,
        private readonly engine: WorkEngineService,
    ) {}

    /** Plugs the tick into the automations engine at boot. */
    onModuleInit(): void {
        this.extensions.add({ tick: (now) => this.tick(now) })
    }

    /** Reminds every booking whose reminder is due; answers how many reminders it handled. */
    async tick(now: Date): Promise<number> {
        const nowMs = now.getTime()
        const due = await this.reminders.claimDue(nowMs, BATCH, this.say("reminderSending"))
        let handled = 0
        await eachInOrder(due, async (reminder) => {
            handled += (await this.settleOne(reminder, nowMs)) ? 1 : 0
        })
        return handled
    }

    /** Settles one taken reminder; true when it went through the gate. */
    private async settleOne(reminder: DueReminder, nowMs: number): Promise<boolean> {
        try {
            const booking = await this.notices.bookingOf(reminder.workspaceId, reminder.bookingId)
            if (
                booking === null ||
                !LIVE_BOOKING_STATUSES.includes(booking.status) ||
                !booking.holds_slot ||
                booking.start_ms <= nowMs
            ) {
                await this.reminders.settle(reminder.id, {
                    status: "skipped",
                    workItemId: null,
                    sentMs: null,
                    note: this.say("reminderStale"),
                })
                return false
            }
            await this.remind(reminder, booking, nowMs)
            return true
        } catch (cause) {
            this.logger.error(WorkPerformersLogEvent.ReminderFailed, cause, {
                workspaceId: reminder.workspaceId,
                reminderId: reminder.id,
            })
            await this.reminders.settle(reminder.id, {
                status: "failed",
                workItemId: null,
                sentMs: null,
                note: (cause instanceof Error ? cause.message : String(cause)).slice(0, NOTE_MAX),
            })
            return false
        }
    }

    private async remind(reminder: DueReminder, booking: EffectsRow, nowMs: number): Promise<void> {
        const settings = await this.notices.settingsOf(booking.workspace_id)
        const card = await this.reminders.cardOf(booking.workspace_id)
        const hours = hoursOfKind(reminder.kind)
        const facts = await this.notices.factsOf(booking.workspace_id, booking, settings, booking.cancel_fee_vnd)
        const text = this.notices.reminderOf(facts, hours, card.body)
        const ctx: WorkContext = {
            workspaceId: booking.workspace_id,
            actor: this.say("reminderActor"),
            locale: LOCALE,
        }
        const item = await this.engine.runWork(ctx, {
            action: "remind_booking",
            subject_type: "lead",
            subject_id: booking.lead_id,
            lead_id: booking.lead_id,
            dedupeKey: `remind_booking:${booking.id}:${reminder.kind}:${reminder.dueMs}`,
            preset: true,
            noChain: true,
            seed: {
                summary: this.say("reminderSummary", {
                    name: booking.customer_name || this.say("reminderCustomer"),
                    hours,
                    when: this.notices.whenOf(booking.start_ms, settings.timezone),
                }),
                draft: text,
                outcome: "clear",
                fields: {
                    booking_id: booking.id,
                    kind: reminder.kind,
                    contact: contactOf(booking.customer_phone, booking.customer_email, this.say("reminderChat")),
                },
            },
        })
        const status = settlementOf(item.status)
        await this.reminders.settle(reminder.id, {
            status,
            workItemId: item.id,
            sentMs: status === "sent" ? nowMs : null,
            note: item.result?.summary ?? item.error ?? "",
        })
    }

    private say(key: string, params: Readonly<Record<string, string | number>> = {}): string {
        return this.catalog.get(`performers.${key}`, params, LOCALE)
    }
}
