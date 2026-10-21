import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AutomationExtensionsService } from "@modules/domain/automations"
import { BookingRemindersService } from "@modules/domain/booking-reminders"
import type { DueReminder } from "@modules/domain/booking-reminders"
import { BookingNoticesService } from "@modules/domain/bookings"
import type { EffectsRow } from "@modules/domain/bookings"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BookingReminderTickService } from "./booking-reminder-tick.service"
import { WORK_PERFORMERS_MESSAGES } from "./messages/work-performers.messages"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

type BookingSettings = Awaited<ReturnType<BookingNoticesService["settingsOf"]>>
type NoticeFacts = Awaited<ReturnType<BookingNoticesService["factsOf"]>>

const now = new Date("2026-10-15T08:00:00.000Z")
const nowMs = now.getTime()
const startMs = nowMs + 24 * 3_600_000

const reminderOf = builder<DueReminder>({
    id: "reminder-1",
    workspaceId: "ws-1",
    bookingId: "booking-1",
    kind: "h24",
    dueMs: nowMs - 60_000,
})

const bookingOf = builder<EffectsRow>({
    id: "booking-1",
    workspace_id: "ws-1",
    status: "confirmed",
    lead_id: "lead-1",
    conversation_id: "conversation-1",
    customer_name: "Lan",
    customer_phone: "0901234567",
    customer_email: "lan@example.com",
    cancel_reason: null,
    reschedule_count: 0,
    service_name: "Haircut",
    price_vnd: 200_000,
    cancel_fee_vnd: 50_000,
    start_ms: startMs,
    cancelled_ms: null,
    resource_name: "Mai",
    deposit_vnd: 20_000,
    from_ms: null,
    holds_slot: true,
})

const settingsOf = builder<BookingSettings>({
    timezone: "Asia/Ho_Chi_Minh",
    slotStepMin: 15,
    minLeadMin: 60,
    maxAdvanceDays: 60,
    cancelWindowHours: 24,
    depositPct: 10,
    lateCancelFeePct: 25,
    noShowFeeVnd: 0,
    autoConfirm: true,
    handoffOrder: false,
    reminderHours: [24, 2],
    publicEnabled: false,
    publicSlug: null,
    publicNote: "",
    address: "12 Main Street",
})

const factsOf = builder<NoticeFacts>({
    shop: "Salon",
    customer: "Lan",
    service: "Haircut",
    resource: "Mai",
    startMs,
    timezone: "Asia/Ho_Chi_Minh",
    address: "12 Main Street",
    depositVnd: 20_000,
    cancelWindowHours: 24,
    fromMs: null,
    feeVnd: 50_000,
})

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "bookings",
    action: "remind_booking",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "done",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Reminder", fields: {} },
    result: { summary: "\u0110\u00e3 nh\u1eafc l\u1ecbch" },
    error: null,
    evidence_state: "captured",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-15T08:00:00.000Z",
    updated_at: "2026-10-15T08:00:00.000Z",
    completed_at: "2026-10-15T08:00:00.000Z",
    installation_id: null,
})

const build = async () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    const logger = mock<Logger>()
    const extensions = mock<AutomationExtensionsService>()
    const reminders = mock<BookingRemindersService>()
    reminders.claimDue.mockResolvedValue([reminderOf()])
    reminders.cardOf.mockResolvedValue({ hours: [24, 2], body: "Custom reminder {customer}" })
    reminders.settle.mockResolvedValue(undefined)
    const notices = mock<BookingNoticesService>()
    notices.bookingOf.mockResolvedValue(bookingOf())
    notices.settingsOf.mockResolvedValue(settingsOf())
    notices.factsOf.mockResolvedValue(factsOf())
    notices.reminderOf.mockReturnValue("L\u1ecbch h\u1eb9n c\u1ee7a Lan c\u00f2n 24 gi\u1edd")
    notices.whenOf.mockReturnValue("15:00 ng\u00e0y 16/10/2026")
    const engine = mock<WorkEngineService>()
    engine.runWork.mockResolvedValue(itemOf())
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingReminderTickService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: AutomationExtensionsService, useValue: extensions },
            { provide: BookingRemindersService, useValue: reminders },
            { provide: BookingNoticesService, useValue: notices },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return {
        service: moduleRef.get(BookingReminderTickService),
        catalog,
        logger,
        extensions,
        reminders,
        notices,
        engine,
    }
}

describe("BookingReminderTickService", () => {
    it("preserves the legacy Vietnamese actor and reminder wording", () => {
        expect(WORK_PERFORMERS_MESSAGES.vi["performers.reminderActor"]).toBe("NIVO \u00b7 Nh\u1eafc l\u1ecbch h\u1eb9n")
        expect(WORK_PERFORMERS_MESSAGES.vi["performers.reminderSending"]).toBe("\u0110ang g\u1eedi")
        expect(WORK_PERFORMERS_MESSAGES.vi["performers.reminderStale"]).toBe(
            "L\u1ecbch \u0111\u00e3 \u0111\u00f3ng ho\u1eb7c \u0111\u00e3 qua gi\u1edd",
        )
        expect(WORK_PERFORMERS_MESSAGES.vi["performers.reminderChat"]).toBe("k\u00eanh chat")
        expect(WORK_PERFORMERS_MESSAGES.vi["performers.reminderSummary"]).toBe(
            "Nh\u1eafc l\u1ecbch {{name}} ({{hours}} gi\u1edd tr\u01b0\u1edbc) \u00b7 {{when}}",
        )
    })

    it("registers an automation extension that delegates its tick and returns the result", async () => {
        const { service, extensions } = await build()
        const tick = jest.spyOn(service, "tick").mockResolvedValue(7)

        service.onModuleInit()

        const extensionTick = extensions.add.mock.calls[0]?.[0].tick
        expect(extensionTick).toBeDefined()
        expect(extensions.add.mock.calls).toEqual([[{ tick: extensionTick }]])
        await expect(extensionTick?.(now)).resolves.toBe(7)
        expect(tick.mock.calls).toEqual([[now]])
    })

    it("claims at most forty due reminders with the sending note and returns zero for an empty batch", async () => {
        const { service, catalog, reminders, notices, engine, logger } = await build()
        reminders.claimDue.mockResolvedValue([])

        await expect(service.tick(now)).resolves.toBe(0)

        expect(reminders.claimDue.mock.calls).toEqual([[nowMs, 40, "performers.reminderSending:{}"]])
        expect(catalog.get.mock.calls).toEqual([["performers.reminderSending", {}, "vi"]])
        expect(notices.bookingOf).not.toHaveBeenCalled()
        expect(reminders.settle).not.toHaveBeenCalled()
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it.each([
        { label: "missing", booking: null },
        { label: "cancelled", booking: bookingOf({ status: "cancelled" }) },
        { label: "done", booking: bookingOf({ status: "done" }) },
        { label: "no-show", booking: bookingOf({ status: "no_show" }) },
        { label: "without a held slot", booking: bookingOf({ holds_slot: false }) },
        { label: "already started", booking: bookingOf({ start_ms: nowMs - 1 }) },
        { label: "starting now", booking: bookingOf({ start_ms: nowMs }) },
    ])("skips a $label booking without submitting work", async ({ booking }) => {
        const { service, catalog, reminders, notices, engine, logger } = await build()
        notices.bookingOf.mockResolvedValue(booking)

        await expect(service.tick(now)).resolves.toBe(0)

        expect(reminders.claimDue.mock.calls).toEqual([[nowMs, 40, "performers.reminderSending:{}"]])
        expect(notices.bookingOf.mock.calls).toEqual([["ws-1", "booking-1"]])
        expect(reminders.settle.mock.calls).toEqual([
            ["reminder-1", { status: "skipped", workItemId: null, sentMs: null, note: "performers.reminderStale:{}" }],
        ])
        expect(catalog.get.mock.calls).toEqual([
            ["performers.reminderSending", {}, "vi"],
            ["performers.reminderStale", {}, "vi"],
        ])
        expect(notices.settingsOf).not.toHaveBeenCalled()
        expect(reminders.cardOf).not.toHaveBeenCalled()
        expect(notices.factsOf).not.toHaveBeenCalled()
        expect(notices.reminderOf).not.toHaveBeenCalled()
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })
})

describe("BookingReminderTickService", () => {
    it.each([
        { status: "requested", phone: "0901234567", email: "lan@example.com", contact: "0901234567" },
        { status: "confirmed", phone: null, email: "lan@example.com", contact: "lan@example.com" },
        { status: "rescheduled", phone: null, email: null, contact: "performers.reminderChat:{}" },
    ])("submits a $status booking with its customer contact", async (row) => {
        const { service, catalog, reminders, notices, engine, logger } = await build()
        const booking = bookingOf({
            status: row.status,
            customer_phone: row.phone,
            customer_email: row.email,
        })
        notices.bookingOf.mockResolvedValue(booking)

        await expect(service.tick(now)).resolves.toBe(1)

        expect(reminders.claimDue.mock.calls).toEqual([[nowMs, 40, "performers.reminderSending:{}"]])
        expect(notices.bookingOf.mock.calls).toEqual([["ws-1", "booking-1"]])
        expect(notices.settingsOf.mock.calls).toEqual([["ws-1"]])
        expect(reminders.cardOf.mock.calls).toEqual([["ws-1"]])
        expect(notices.factsOf.mock.calls).toEqual([["ws-1", booking, settingsOf(), 50_000]])
        expect(notices.reminderOf.mock.calls).toEqual([[factsOf(), 24, "Custom reminder {customer}"]])
        expect(notices.whenOf.mock.calls).toEqual([[startMs, "Asia/Ho_Chi_Minh"]])
        expect(engine.runWork.mock.calls).toEqual([
            [
                { workspaceId: "ws-1", actor: "performers.reminderActor:{}", locale: "vi" },
                {
                    action: "remind_booking",
                    subject_type: "lead",
                    subject_id: "lead-1",
                    lead_id: "lead-1",
                    dedupeKey: `remind_booking:booking-1:h24:${nowMs - 60_000}`,
                    preset: true,
                    noChain: true,
                    seed: {
                        summary:
                            'performers.reminderSummary:{"name":"Lan","hours":24,"when":"15:00 ng\u00e0y 16/10/2026"}',
                        draft: "L\u1ecbch h\u1eb9n c\u1ee7a Lan c\u00f2n 24 gi\u1edd",
                        outcome: "clear",
                        fields: { booking_id: "booking-1", kind: "h24", contact: row.contact },
                    },
                },
            ],
        ])
        expect(reminders.settle.mock.calls).toEqual([
            [
                "reminder-1",
                { status: "sent", workItemId: "item-1", sentMs: nowMs, note: "\u0110\u00e3 nh\u1eafc l\u1ecbch" },
            ],
        ])
        expect(catalog.get.mock.calls).toEqual([
            ["performers.reminderSending", {}, "vi"],
            ["performers.reminderActor", {}, "vi"],
            ["performers.reminderSummary", { name: "Lan", hours: 24, when: "15:00 ng\u00e0y 16/10/2026" }, "vi"],
            ["performers.reminderChat", {}, "vi"],
        ])
        expect(logger.error).not.toHaveBeenCalled()
    })
})

describe("BookingReminderTickService", () => {
    it.each<{
        status: WorkItem["status"]
        settlement: string
        result: WorkItem["result"]
        error: WorkItem["error"]
        note: string
    }>([
        { status: "done", settlement: "sent", result: { summary: "Sent" }, error: "Ignored", note: "Sent" },
        {
            status: "waiting_decision",
            settlement: "waiting",
            result: null,
            error: "Owner decides",
            note: "Owner decides",
        },
        { status: "rejected", settlement: "skipped", result: null, error: null, note: "" },
        { status: "failed", settlement: "failed", result: { summary: "" }, error: "Ignored", note: "" },
        { status: "queued", settlement: "failed", result: null, error: "Queued", note: "Queued" },
    ])("settles a $status work item as $settlement and counts the gate submission", async (row) => {
        const { service, reminders, engine } = await build()
        engine.runWork.mockResolvedValue(itemOf({ status: row.status, result: row.result, error: row.error }))

        await expect(service.tick(now)).resolves.toBe(1)

        expect(engine.runWork).toHaveBeenCalledTimes(1)
        expect(reminders.settle.mock.calls).toEqual([
            [
                "reminder-1",
                {
                    status: row.settlement,
                    workItemId: "item-1",
                    sentMs: row.status === "done" ? nowMs : null,
                    note: row.note,
                },
            ],
        ])
    })
})

describe("BookingReminderTickService", () => {
    it.each([
        { stage: "notices", cause: new Error("x".repeat(350)), note: "x".repeat(300) },
        { stage: "engine", cause: "y".repeat(350), note: "y".repeat(300) },
    ])("settles a $stage failure and continues with the next reminder", async ({ stage, cause, note }) => {
        const { service, reminders, notices, engine, logger } = await build()
        reminders.claimDue.mockResolvedValue([
            reminderOf(),
            reminderOf({ id: "reminder-2", bookingId: "booking-2", kind: "h2", dueMs: nowMs - 30_000 }),
        ])
        notices.bookingOf.mockResolvedValueOnce(bookingOf()).mockResolvedValueOnce(bookingOf({ id: "booking-2" }))
        if (stage === "notices") notices.factsOf.mockRejectedValueOnce(cause)
        else engine.runWork.mockRejectedValueOnce(cause)

        await expect(service.tick(now)).resolves.toBe(1)

        expect(notices.bookingOf.mock.calls).toEqual([
            ["ws-1", "booking-1"],
            ["ws-1", "booking-2"],
        ])
        expect(logger.error.mock.calls).toEqual([
            [WorkPerformersLogEvent.ReminderFailed, cause, { workspaceId: "ws-1", reminderId: "reminder-1" }],
        ])
        expect(reminders.settle.mock.calls).toEqual([
            ["reminder-1", { status: "failed", workItemId: null, sentMs: null, note }],
            [
                "reminder-2",
                { status: "sent", workItemId: "item-1", sentMs: nowMs, note: "\u0110\u00e3 nh\u1eafc l\u1ecbch" },
            ],
        ])
        expect(engine.runWork).toHaveBeenLastCalledWith(
            { workspaceId: "ws-1", actor: "performers.reminderActor:{}", locale: "vi" },
            {
                action: "remind_booking",
                subject_type: "lead",
                subject_id: "lead-1",
                lead_id: "lead-1",
                dedupeKey: `remind_booking:booking-2:h2:${nowMs - 30_000}`,
                preset: true,
                noChain: true,
                seed: {
                    summary: 'performers.reminderSummary:{"name":"Lan","hours":2,"when":"15:00 ng\u00e0y 16/10/2026"}',
                    draft: "L\u1ecbch h\u1eb9n c\u1ee7a Lan c\u00f2n 24 gi\u1edd",
                    outcome: "clear",
                    fields: { booking_id: "booking-2", kind: "h2", contact: "0901234567" },
                },
            },
        )
    })

    it("names a customer without a name by the legacy fallback word in the summary", async () => {
        const { service, catalog, notices, engine } = await build()
        notices.bookingOf.mockResolvedValue(bookingOf({ customer_name: "" }))

        await expect(service.tick(now)).resolves.toBe(1)

        const when = notices.whenOf.mock.results[0]?.value
        expect(engine.runWork.mock.calls[0]?.[1].seed?.summary).toBe(
            `performers.reminderSummary:{"name":"performers.reminderCustomer:{}","hours":24,"when":"${when}"}`,
        )
        expect(catalog.get.mock.calls).toContainEqual(["performers.reminderCustomer", {}, "vi"])
    })
})
