import { Injectable } from "@nestjs/common"
import { In, LessThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { AutomationPipelineEntity } from "@modules/domain/automation-pipelines"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { BookingReminderEntity } from "./persistence/entities"
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

/** The template key of the appointment reminder card. */
const REMINDER_TEMPLATE = "appointment_reminder"

@Injectable()
/** Plans the reminders of a booking: one row per offset that is still ahead, rewritten when the booking moves. */
export class BookingRemindersService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Takes up to `limit` reminders that are due at `nowMs`, oldest first; each is returned to one caller only. */
    async claimDue(nowMs: number, limit: number, note: string): Promise<ReadonlyArray<DueReminder>> {
        const rows = await this.entityManager.transaction(async (manager) => {
            const due = await manager
                .createQueryBuilder(BookingReminderEntity, "r")
                .where("r.status = :status", { status: "scheduled" })
                .andWhere("r.dueAt <= :now", { now: new Date(nowMs) })
                .orderBy("r.dueAt", "ASC")
                .limit(limit)
                .setLock("pessimistic_write")
                .setOnLocked("skip_locked")
                .getMany()
            if (due.length > 0)
                await manager.update(
                    BookingReminderEntity,
                    { id: In(due.map((row) => row.id)) },
                    { status: "waiting", note },
                )
            return due
        })
        return rows
            .map((row) => ({
                id: row.id,
                workspaceId: row.workspaceId,
                bookingId: row.bookingId,
                kind: row.kind,
                dueMs: row.dueAt.getTime(),
            }))
            .sort((a, b) => a.dueMs - b.dueMs)
    }

    /** Writes where a taken reminder ended. */
    async settle(id: string, settlement: ReminderSettlement): Promise<void> {
        await this.entityManager.update(
            BookingReminderEntity,
            { id },
            {
                status: settlement.status,
                workItemId: settlement.workItemId,
                sentAt: settlement.sentMs === null ? null : new Date(settlement.sentMs),
                note: settlement.note,
            },
        )
    }

    /** The offsets and the wording the owner set on the reminder card; none when the card is off. */
    async cardOf(workspaceId: string): Promise<ReminderCard> {
        const card = await this.entityManager.findOne(AutomationPipelineEntity, {
            select: { config: true, body: true },
            where: { workspaceId, templateKey: REMINDER_TEMPLATE, enabled: true },
        })
        return { hours: cardReminderHours(card?.config ?? null), body: cardReminderBody(card?.body) }
    }

    /** Writes the reminders still ahead and cancels those that are already due and no longer apply. */
    async schedule(target: ReminderTarget): Promise<ReadonlyArray<ReminderDue>> {
        const { manager } = target
        const card = await manager.findOne(AutomationPipelineEntity, {
            select: { config: true },
            where: { workspaceId: target.workspaceId, templateKey: REMINDER_TEMPLATE, enabled: true },
        })
        const custom = cardReminderHours(card?.config ?? null)
        const plan = reminderPlan(target.startMs, custom.length > 0 ? custom : target.defaultHours, target.nowMs)
        if (plan.length > 0) {
            await manager.upsert(
                BookingReminderEntity,
                plan.map((reminder) => ({
                    workspaceId: target.workspaceId,
                    bookingId: target.bookingId,
                    kind: reminder.kind,
                    dueAt: new Date(reminder.dueMs),
                    status: "scheduled" as const,
                    workItemId: null,
                    sentAt: null,
                    note: "",
                })),
                ["bookingId", "kind"],
            )
        }
        await manager.update(
            BookingReminderEntity,
            { bookingId: target.bookingId, status: "scheduled", dueAt: LessThanOrEqual(new Date(target.nowMs)) },
            { status: "cancelled", note: "past_due_after_move" },
        )
        return plan
    }

    /** Cancels every reminder of a booking that has not gone out. */
    async cancel(manager: EntityManager, bookingId: string, note: string): Promise<void> {
        await manager.update(
            BookingReminderEntity,
            { bookingId, status: In(["scheduled", "waiting"]) },
            { status: "cancelled", note },
        )
    }
}
