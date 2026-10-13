import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import {
    CANCEL_OPEN_REMINDERS,
    CANCEL_STALE_REMINDERS,
    SELECT_REMINDER_CARD,
    UPSERT_REMINDERS,
} from "./persistence/booking-reminders.sql"
import { cardReminderHours, reminderPlan } from "./policies/reminder-plan.policy"
import type { ReminderDue } from "./policies/reminder-plan.policy"

/** A booking whose reminders are planned. */
export interface ReminderTarget {
    /** The transaction the plan joins. */
    readonly manager: EntityManager
    /** The workspace. */
    readonly workspaceId: string
    /** The booking. */
    readonly bookingId: string
    /** The start instant of the booking. */
    readonly startMs: number
    /** The instant of the plan. */
    readonly nowMs: number
    /** The offsets of the module policy, used when the owner customised none. */
    readonly defaultHours: ReadonlyArray<number>
}

@Injectable()
/** Plans the reminders of a booking: one row per offset that is still ahead, rewritten when the booking moves. */
export class BookingRemindersService {
    /** Writes the reminders still ahead and cancels those that are already due and no longer apply. */
    async schedule(target: ReminderTarget): Promise<ReadonlyArray<ReminderDue>> {
        const { manager } = target
        const [card] = await manager.query<Array<{ config: Readonly<Record<string, unknown>> | null }>>(
            SELECT_REMINDER_CARD,
            [target.workspaceId],
        )
        const custom = cardReminderHours(card?.config ?? null)
        const plan = reminderPlan(target.startMs, custom.length > 0 ? custom : target.defaultHours, target.nowMs)
        if (plan.length > 0) {
            await manager.query(UPSERT_REMINDERS, [
                target.workspaceId,
                target.bookingId,
                plan.map((reminder) => reminder.kind),
                plan.map((reminder) => new Date(reminder.dueMs).toISOString()),
            ])
        }
        await manager.query(CANCEL_STALE_REMINDERS, [
            target.bookingId,
            new Date(target.nowMs).toISOString(),
            "past_due_after_move",
        ])
        return plan
    }

    /** Cancels every reminder of a booking that has not gone out. */
    async cancel(manager: EntityManager, bookingId: string, note: string): Promise<void> {
        await manager.query(CANCEL_OPEN_REMINDERS, [bookingId, note])
    }
}
