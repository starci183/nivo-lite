import { builder, FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { BookingNoticesService } from "@modules/domain/bookings"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { CLOCK } from "@modules/platform/clock"
import { BookingRemindPerformerService } from "./booking-remind-performer.service"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { WORK_PERFORMERS_MESSAGES } from "./messages/work-performers.messages"
import { PerformerKitService } from "./performer-kit.service"

type Booking = NonNullable<Awaited<ReturnType<BookingNoticesService["bookingOf"]>>>
type BookingSettings = Awaited<ReturnType<BookingNoticesService["settingsOf"]>>

const ctx: WorkContext = { workspaceId: "ws-1", actor: "NIVO", locale: "vi" }
const now = "2026-10-15T09:00:00.000Z"
const nowMs = Date.parse(now)
const startMs = Date.parse("2026-10-16T09:00:00.000Z")
const draft = "Ch\u00e0o Lan, nh\u1eafc b\u1ea1n l\u1ecbch C\u1eaft t\u00f3c ng\u00e0y mai nh\u00e9."

const proposalOf = builder<Proposal>({ summary: "Nh\u1eafc l\u1ecbch Lan", draft, fields: { booking_id: "booking-1" } })

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "bookings",
    action: "remind_booking",
    subject_type: "lead",
    subject_id: "item-lead",
    lead_id: "item-lead",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: proposalOf(),
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: now,
    updated_at: now,
    completed_at: null,
    installation_id: null,
})

const bookingOf = builder<Booking>({
    id: "booking-1",
    workspace_id: "ws-1",
    status: "confirmed",
    lead_id: "booking-lead",
    conversation_id: "conversation-1",
    customer_name: "Lan",
    customer_phone: "84901234567",
    customer_email: "lan@example.com",
    origin: "live",
    cancel_reason: null,
    reschedule_count: 0,
    service_name: "C\u1eaft t\u00f3c",
    price_vnd: 100000,
    cancel_fee_vnd: 0,
    start_ms: startMs,
    cancelled_ms: null,
    resource_name: "Mai",
    deposit_vnd: 0,
    from_ms: null,
    holds_slot: true,
})

const settings: BookingSettings = {
    timezone: "Asia/Ho_Chi_Minh",
    slotStepMin: 30,
    minLeadMin: 60,
    maxAdvanceDays: 30,
    cancelWindowHours: 2,
    depositPct: 0,
    lateCancelFeePct: 0,
    noShowFeeVnd: 0,
    autoConfirm: true,
    handoffOrder: false,
    reminderHours: [24, 2],
    publicEnabled: false,
    publicSlug: null,
    publicNote: "",
    address: "12 Nguy\u1ec5n Hu\u1ec7",
}

describe("BookingRemindPerformerService", () => {
    const build = async () => {
        const kit = mock<PerformerKitService>()
        kit.text.mockImplementation((_ctx, key, params) => `${key}:${JSON.stringify(params)}`)
        const notices = mock<BookingNoticesService>()
        notices.deliver.mockResolvedValue({ delivered: true, kept: true, via: "zalo" })
        const notifier = { notify: notices.deliver }
        notices.bookingOf.mockResolvedValue(bookingOf())
        notices.settingsOf.mockResolvedValue(settings)
        notices.subjectOf.mockReturnValue("Nh\u1eafc l\u1ecbch h\u1eb9n")
        notices.whenOf.mockReturnValue("16:00 ng\u00e0y 16/10/2026")
        const moduleRef = await Test.createTestingModule({
            providers: [
                BookingRemindPerformerService,
                { provide: CLOCK, useValue: new FakeClock(now) },
                { provide: PerformerKitService, useValue: kit },
                { provide: BookingNoticesService, useValue: notices },
            ],
        }).compile()
        return { service: moduleRef.get(BookingRemindPerformerService), notifier, kit, notices }
    }

    it("preserves the original Vietnamese reminder wording", () => {
        expect(WORK_PERFORMERS_MESSAGES.vi["performers.reminderClosed"]).toBe(
            "L\u1ecbch \u0111\u00e3 \u0111\u00f3ng ho\u1eb7c \u0111\u00e3 qua gi\u1edd, kh\u00f4ng nh\u1eafc.",
        )
        expect(WORK_PERFORMERS_MESSAGES.vi["performers.reminderSent"]).toBe(
            "\u0111\u00e3 nh\u1eafn kh\u00e1ch ({{via}})",
        )
        expect(WORK_PERFORMERS_MESSAGES.vi["performers.reminderNoChannel"]).toBe(
            "ch\u01b0a c\u00f3 k\u00eanh nh\u1eafn kh\u00e1ch",
        )
        expect(WORK_PERFORMERS_MESSAGES.vi["performers.reminderDone"]).toBe(
            "Nh\u1eafc l\u1ecbch {{name}} l\u00fac {{when}}: {{told}}.",
        )
        expect(WORK_PERFORMERS_MESSAGES.vi["errors.WORK_PERFORMERS_REMINDER_EMPTY"]).toBe(
            "Kh\u00f4ng c\u00f3 n\u1ed9i dung nh\u1eafc.",
        )
    })

    it("returns the preset proposal without reading or sending the booking", async () => {
        const { service, notifier, kit, notices } = await build()
        const item = itemOf()

        const prepared = await service.prepare(ctx, item)

        expect(prepared).toEqual({ proposal: item.proposal })
        expect(prepared.proposal).toBe(item.proposal)
        expect(notices.bookingOf).not.toHaveBeenCalled()
        expect(notifier.notify).not.toHaveBeenCalled()
        expect(kit.text).not.toHaveBeenCalled()
    })

    it.each<Proposal["fields"]>([{}, { booking_id: null }, { booking_id: "" }])(
        "rejects a missing booking id before reading or sending (%j)",
        async (fields) => {
            const { service, notifier, kit, notices } = await build()

            const performed = service.perform(ctx, itemOf(), proposalOf({ fields }))

            await expect(performed).rejects.toBeInstanceOf(WorkPerformersError)
            await expect(performed).rejects.toThrow(
                new WorkPerformersError({ code: WorkPerformersErrorCode.SubjectMissing }),
            )
            expect(notices.bookingOf).not.toHaveBeenCalled()
            expect(notifier.notify).not.toHaveBeenCalled()
            expect(kit.text).not.toHaveBeenCalled()
        },
    )

    it("rejects a booking that no longer exists in the workspace", async () => {
        const { service, notifier, kit, notices } = await build()
        notices.bookingOf.mockResolvedValue(null)

        const performed = service.perform(ctx, itemOf(), proposalOf())

        await expect(performed).rejects.toBeInstanceOf(WorkPerformersError)
        await expect(performed).rejects.toThrow(
            new WorkPerformersError({ code: WorkPerformersErrorCode.SubjectMissing }),
        )
        expect(notices.bookingOf.mock.calls).toEqual([["ws-1", "booking-1"]])
        expect(notifier.notify).not.toHaveBeenCalled()
        expect(kit.text).not.toHaveBeenCalled()
    })

    it.each(["cancelled", "done", "no_show"])("does not remind a %s booking", async (status) => {
        const { service, notifier, kit, notices } = await build()
        notices.bookingOf.mockResolvedValue(bookingOf({ status }))

        await expect(service.perform(ctx, itemOf(), proposalOf())).resolves.toEqual({
            summary: "reminderClosed:undefined",
            evidence: "captured",
            lead_id: "item-lead",
        })
        expect(notices.bookingOf.mock.calls).toEqual([["ws-1", "booking-1"]])
        expect(kit.text.mock.calls).toEqual([[ctx, "reminderClosed"]])
        expect(notifier.notify).not.toHaveBeenCalled()
        expect(notices.settingsOf).not.toHaveBeenCalled()
    })

    it.each([nowMs, nowMs - 1])("does not remind a booking whose start is already reached (%i)", async (start) => {
        const { service, notifier, kit, notices } = await build()
        notices.bookingOf.mockResolvedValue(bookingOf({ status: "requested", start_ms: start }))

        await expect(service.perform(ctx, itemOf({ lead_id: null }), proposalOf())).resolves.toEqual({
            summary: "reminderClosed:undefined",
            evidence: "captured",
            lead_id: null,
        })
        expect(notices.bookingOf.mock.calls).toEqual([["ws-1", "booking-1"]])
        expect(kit.text.mock.calls).toEqual([[ctx, "reminderClosed"]])
        expect(notifier.notify).not.toHaveBeenCalled()
        expect(notices.settingsOf).not.toHaveBeenCalled()
    })

    it.each<Proposal>([
        proposalOf({ draft: "" }),
        { summary: "Nh\u1eafc l\u1ecbch Lan", fields: { booking_id: "booking-1" } },
    ])("rejects a live reminder with an empty or missing draft (%j)", async (proposal) => {
        const { service, notifier, kit, notices } = await build()

        const performed = service.perform(ctx, itemOf(), proposal)

        await expect(performed).rejects.toBeInstanceOf(WorkPerformersError)
        await expect(performed).rejects.toThrow(
            new WorkPerformersError({ code: WorkPerformersErrorCode.ReminderEmpty }),
        )
        expect(notices.bookingOf.mock.calls).toEqual([["ws-1", "booking-1"]])
        expect(notifier.notify).not.toHaveBeenCalled()
        expect(notices.subjectOf).not.toHaveBeenCalled()
        expect(notices.settingsOf).not.toHaveBeenCalled()
        expect(kit.text).not.toHaveBeenCalled()
    })

    it.each([
        { delivered: true, via: "zalo", toldKey: "reminderSent", status: "requested" },
        { delivered: true, via: "email", toldKey: "reminderSent", status: "confirmed" },
        { delivered: false, via: "none", toldKey: "reminderNoChannel", status: "rescheduled" },
    ])("sends a live $status reminder and records delivery=$delivered via $via", async (delivery) => {
        const { service, notifier, kit, notices } = await build()
        const item = itemOf()
        notices.bookingOf.mockResolvedValue(bookingOf({ status: delivery.status }))
        notifier.notify.mockResolvedValue({
            delivered: delivery.delivered,
            kept: delivery.delivered,
            via: delivery.via,
        })
        const told = `${delivery.toldKey}:${JSON.stringify({ via: delivery.via })}`

        await expect(service.perform(ctx, item, proposalOf())).resolves.toEqual({
            summary: `reminderDone:${JSON.stringify({ name: "Lan", when: "16:00 ng\u00e0y 16/10/2026", told })}`,
            evidence: "captured",
            lead_id: "item-lead",
            detail: draft,
        })
        expect(notices.bookingOf.mock.calls).toEqual([["ws-1", "booking-1"]])
        expect(notices.subjectOf.mock.calls).toEqual([["reminder", "C\u1eaft t\u00f3c"]])
        expect(notifier.notify.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    bookingId: "booking-1",
                    kind: "reminder",
                    leadId: "booking-lead",
                    conversationId: "conversation-1",
                    email: "lan@example.com",
                    subject: "Nh\u1eafc l\u1ecbch h\u1eb9n",
                    text: draft,
                    dedupeKey: "remind:item-1",
                    workItemId: "item-1",
                },
            ],
        ])
        expect(notices.settingsOf.mock.calls).toEqual([["ws-1"]])
        expect(notices.whenOf.mock.calls).toEqual([[startMs, "Asia/Ho_Chi_Minh"]])
        expect(kit.text.mock.calls).toEqual([
            [ctx, delivery.toldKey, { via: delivery.via }],
            [ctx, "reminderDone", { name: "Lan", when: "16:00 ng\u00e0y 16/10/2026", told }],
        ])
    })

    it("names a customer without a name by the fallback word", async () => {
        const { service, kit, notices } = await build()
        notices.bookingOf.mockResolvedValue(bookingOf({ customer_name: "" }))

        await service.perform(ctx, itemOf(), proposalOf())

        expect(kit.text.mock.calls).toContainEqual([ctx, "reminderCustomer"])
    })
})
