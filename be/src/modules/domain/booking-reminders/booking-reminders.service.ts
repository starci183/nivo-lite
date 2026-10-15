import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    CANCEL_OPEN_REMINDERS,
    CANCEL_STALE_REMINDERS,
    CLAIM_DUE_REMINDERS,
    SELECT_REMINDER_CARD,
    SETTLE_REMINDER,
    UPSERT_REMINDERS,
} from "./persistence/booking-reminders.sql"
import { cardReminderBody, cardReminderHours, reminderPlan } from "./policies/reminder-plan.policy"
import type { DueReminder, ReminderCard, ReminderDue } from "./policies/reminder-plan.policy"

/** How a taken reminder ended. */
export interface ReminderSettlement {
    /** `sent`, `waiting`, `skipped` or `failed`. */
    readonly status: "sent" | "waiting" | "skipped" | "failed"
    /** The work item that carried it, or null. */
    readonly workItemId: string | null
    /** When it was sent, or null. */
    readonly sentMs: number | null
    /** A sentence the owner can read. */
    readonly note: string
}

/** A row of the claim. */
interface DueRow {
    readonly id: string
    readonly workspace_id: string
    readonly booking_id: string
    readonly kind: string
    readonly due_ms: number
}

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
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Takes up to `limit` reminders that are due at `nowMs`, oldest first; each is returned to one caller only. */
    async claimDue(nowMs: number, limit: number, note: string): Promise<ReadonlyArray<DueReminder>> {
        const rows = await this.entityManager.query<Array<DueRow>>(CLAIM_DUE_REMINDERS, [
            new Date(nowMs).toISOString(),
            limit,
            note,
        ])
        return rows
            .map((row) => ({
                id: row.id,
                workspaceId: row.workspace_id,
                bookingId: row.booking_id,
                kind: row.kind,
                dueMs: row.due_ms,
            }))
            .sort((a, b) => a.dueMs - b.dueMs)
    }

    /** Writes where a taken reminder ended. */
    async settle(id: string, settlement: ReminderSettlement): Promise<void> {
        await this.entityManager.query(SETTLE_REMINDER, [
            id,
            settlement.status,
            settlement.workItemId,
            settlement.sentMs === null ? null : new Date(settlement.sentMs).toISOString(),
            settlement.note,
        ])
    }

    /** The offsets and the wording the owner set on the reminder card; none when the card is off. */
    async cardOf(workspaceId: string): Promise<ReminderCard> {
        const [card] = await this.entityManager.query<
            Array<{ config: Readonly<Record<string, unknown>> | null; body: string | null }>
        >(SELECT_REMINDER_CARD, [workspaceId])
        return { hours: cardReminderHours(card?.config ?? null), body: cardReminderBody(card?.body) }
    }

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
