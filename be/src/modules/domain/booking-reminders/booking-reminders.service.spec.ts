import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { In, LessThanOrEqual } from "typeorm"
import { AutomationPipelineEntity } from "@modules/domain/automation-pipelines"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import {
    CANCELLED_BOOKING_DONE,
    CARD_CONFIG_READ,
    CARD_WHERE,
    HOUR,
    NOW,
    OPEN_REMINDERS_OF_B1,
    REMINDER_R1_WHERE,
    SENT_SETTLEMENT,
    overdueDayReminder,
    secondBookingReminder,
    skippedSettlement,
    targetOf,
} from "@tests/fixtures/builders/booking-reminders.builder"
import { BookingRemindersService } from "./booking-reminders.service"
import { BookingReminderEntity } from "./persistence/entities"

const cardOf = (config: Record<string, unknown> | null, body: string | null = null) =>
    Object.assign(new AutomationPipelineEntity(), { config, body })

const build = async (manager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingRemindersService, { provide: PRIMARY_ENTITY_MANAGER, useValue: manager }],
    }).compile()
    return moduleRef.get(BookingRemindersService)
}

describe("BookingRemindersService claimDue", () => {
    it("claims the due reminders, turns them waiting and maps them in due order", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [BookingReminderEntity, {}] }))
        const [fake] = queueQueryBuilders(tx.em, [
            {
                getMany: [secondBookingReminder(), overdueDayReminder()],
            },
        ])
        const reminders = await build(tx.em)

        await expect(reminders.claimDue(NOW, 40, "Sending")).resolves.toEqual([
            { id: "r1", workspaceId: "ws-1", bookingId: "b1", kind: "h24", dueMs: NOW - HOUR },
            { id: "r2", workspaceId: "ws-2", bookingId: "b2", kind: "h2", dueMs: NOW },
        ])

        expect(fake?.callsOf("andWhere")).toEqual([["r.dueAt <= :now", { now: new Date(NOW) }]])
        expect(fake?.callsOf("limit")).toEqual([[40]])
        expect(fake?.callsOf("setLock")).toEqual([["pessimistic_write"]])
        expect(fake?.callsOf("setOnLocked")).toEqual([["skip_locked"]])
        expect(tx.em.update).toHaveBeenCalledWith(
            BookingReminderEntity,
            { id: In(["r2", "r1"]) },
            { status: "waiting", note: "Sending" },
        )
        expect(tx.commits).toBe(1)
    })

    it("returns an empty plan when no reminder is due", async () => {
        const tx = fakeTransaction(mockEntityManager())
        queueQueryBuilders(tx.em, [{ getMany: [] }])
        const reminders = await build(tx.em)

        await expect(reminders.claimDue(NOW, 3, "Sending")).resolves.toEqual([])

        expect(tx.em.update).not.toHaveBeenCalled()
    })
})

describe("BookingRemindersService settle", () => {
    it("records a sent reminder with its work item and sent instant", async () => {
        const manager = mockEntityManager({ update: [BookingReminderEntity, {}] })
        const reminders = await build(manager)

        await expect(
            reminders.settle("r1", {
                status: "sent",
                workItemId: "item-1",
                sentMs: NOW,
                note: "Customer messaged",
            }),
        ).resolves.toBeUndefined()

        expect(manager.update.mock.calls).toEqual([[BookingReminderEntity, REMINDER_R1_WHERE, SENT_SETTLEMENT]])
    })

    it("records a skipped reminder without a work item or sent instant", async () => {
        const manager = mockEntityManager({ update: [BookingReminderEntity, {}] })
        const reminders = await build(manager)
        const note = "Booking closed or already past"

        await expect(
            reminders.settle("r1", { status: "skipped", workItemId: null, sentMs: null, note }),
        ).resolves.toBeUndefined()

        expect(manager.update.mock.calls).toEqual([[BookingReminderEntity, REMINDER_R1_WHERE, skippedSettlement(note)]])
    })
})

describe("BookingRemindersService cardOf", () => {
    it("reads the custom hours and trims the wording of the reminder card", async () => {
        const manager = mockEntityManager({
            findOne: [AutomationPipelineEntity, cardOf({ firstHours: 24, secondHours: "2" }, "  Hello {{customer}}  ")],
        })
        const reminders = await build(manager)

        await expect(reminders.cardOf("ws-1")).resolves.toEqual({ hours: [24, 2], body: "Hello {{customer}}" })

        expect(manager.findOne.mock.calls).toEqual([
            [AutomationPipelineEntity, { select: { config: true, body: true }, where: CARD_WHERE }],
        ])
    })

    it("returns no hours or body when there is no enabled card", async () => {
        const manager = mockEntityManager({ findOne: [AutomationPipelineEntity, null] })
        const reminders = await build(manager)

        await expect(reminders.cardOf("ws-1")).resolves.toEqual({ hours: [], body: null })

        expect(manager.findOne).toHaveBeenCalledTimes(1)
    })

    it.each([null, "", " \n\t "])("returns no wording for a blank body %j", async (body) => {
        const manager = mockEntityManager({ findOne: [AutomationPipelineEntity, cardOf(null, body)] })
        const reminders = await build(manager)

        await expect(reminders.cardOf("ws-1")).resolves.toEqual({ hours: [], body: null })
    })
})

describe("BookingRemindersService schedule", () => {
    const planned = (kinds: ReadonlyArray<string>, dues: ReadonlyArray<number>) => [
        BookingReminderEntity,
        kinds.map((kind, index) => ({
            workspaceId: "ws-1",
            bookingId: "b1",
            kind,
            dueAt: new Date(dues[index] ?? 0),
            status: "scheduled",
            workItemId: null,
            sentAt: null,
            note: "",
        })),
        ["bookingId", "kind"],
    ]
    const STALE = [
        BookingReminderEntity,
        { bookingId: "b1", status: "scheduled", dueAt: LessThanOrEqual(new Date(NOW)) },
        { status: "cancelled", note: "past_due_after_move" },
    ]

    it("writes one reminder per default offset still ahead and cancels the stale ones", async () => {
        const manager = mockEntityManager({
            findOne: [AutomationPipelineEntity, null],
            upsert: [BookingReminderEntity, {}],
            update: [BookingReminderEntity, {}],
        })
        const reminders = await build()

        const plan = await reminders.schedule({ ...targetOf(), manager })

        expect(plan).toEqual([
            { kind: "h24", dueMs: NOW + 6 * HOUR },
            { kind: "h2", dueMs: NOW + 28 * HOUR },
        ])
        expect(manager.findOne.mock.calls).toEqual([[AutomationPipelineEntity, CARD_CONFIG_READ]])
        expect(manager.upsert.mock.calls).toEqual([planned(["h24", "h2"], [NOW + 6 * HOUR, NOW + 28 * HOUR])])
        expect(manager.update.mock.calls).toEqual([STALE])
    })

    it("uses the offsets of the reminder card the owner customised", async () => {
        const manager = mockEntityManager({
            findOne: [AutomationPipelineEntity, cardOf({ firstHours: 12, secondHours: 1 })],
            upsert: [BookingReminderEntity, {}],
            update: [BookingReminderEntity, {}],
        })
        const reminders = await build()

        const plan = await reminders.schedule({ ...targetOf(), manager })

        expect(plan).toEqual([
            { kind: "h12", dueMs: NOW + 18 * HOUR },
            { kind: "h1", dueMs: NOW + 29 * HOUR },
        ])
        expect(manager.upsert.mock.calls).toEqual([planned(["h12", "h1"], [NOW + 18 * HOUR, NOW + 29 * HOUR])])
        expect(manager.update.mock.calls).toEqual([STALE])
    })

    it("writes nothing when every offset is already past", async () => {
        const manager = mockEntityManager({
            findOne: [AutomationPipelineEntity, cardOf(null)],
            update: [BookingReminderEntity, {}],
        })
        const reminders = await build()

        const plan = await reminders.schedule({ ...targetOf({ startMs: NOW + HOUR }), manager })

        expect(plan).toEqual([])
        expect(manager.upsert).not.toHaveBeenCalled()
        expect(manager.update.mock.calls).toEqual([STALE])
    })
})

describe("BookingRemindersService cancel", () => {
    it("cancels every open reminder of the booking", async () => {
        const manager = mockEntityManager({ update: [BookingReminderEntity, {}] })
        const reminders = await build()

        await expect(reminders.cancel(manager, "b1", "booking_done")).resolves.toBeUndefined()

        expect(manager.update.mock.calls).toEqual([
            [BookingReminderEntity, OPEN_REMINDERS_OF_B1, CANCELLED_BOOKING_DONE],
        ])
    })
})
