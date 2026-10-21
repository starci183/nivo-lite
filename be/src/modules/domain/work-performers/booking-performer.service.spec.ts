import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { BookingDeskService } from "@modules/domain/bookings"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { BookingPerformerService } from "./booking-performer.service"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }
const startAt = "2026-10-15T09:00:00.000Z"
const newStart = "2026-10-16T10:00:00.000Z"

const proposalOf = builder<Proposal>({
    summary: "Booking action",
    fields: { booking_id: "booking-1", service: "Haircut", customer_name: "Lan", start_at: startAt },
})

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "bookings",
    action: "cancel_booking",
    subject_type: "conversation",
    subject_id: "conversation-1",
    lead_id: "lead-1",
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
    created_at: "2026-10-14T09:00:00.000Z",
    updated_at: "2026-10-14T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const build = async () => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    const desk = mock<BookingDeskService>()
    desk.confirmApproved.mockResolvedValue({ status: "confirmed", feeDue: false })
    desk.cancelApproved.mockResolvedValue({ status: "cancelled", feeDue: false })
    desk.moveApproved.mockResolvedValue({ ok: true, reason: null, id: "booking-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingPerformerService,
            { provide: PerformerKitService, useValue: kit },
            { provide: BookingDeskService, useValue: desk },
        ],
    }).compile()
    return { service: moduleRef.get(BookingPerformerService), kit, desk }
}

describe("BookingPerformerService prepare", () => {
    it("keeps the preset proposal without changing the booking", async () => {
        const { service, kit, desk } = await build()
        const item = itemOf()

        const prepared = await service.prepare(ctx, item)

        expect(prepared).toEqual({ proposal: item.proposal })
        expect(prepared.proposal).toBe(item.proposal)
        expect(desk.cancelApproved).not.toHaveBeenCalled()
        expect(desk.confirmApproved).not.toHaveBeenCalled()
        expect(desk.moveApproved).not.toHaveBeenCalled()
        expect(kit.text).not.toHaveBeenCalled()
    })
})

describe("BookingPerformerService perform", () => {
    it.each<Proposal["fields"]>([{}, { booking_id: null }, { booking_id: "" }])(
        "refuses a proposal that names no booking (%j) before calling the desk",
        async (fields) => {
            const { service, kit, desk } = await build()

            await expect(service.perform(ctx, itemOf(), proposalOf({ fields }))).rejects.toMatchObject({
                code: WorkPerformersErrorCode.SubjectMissing,
            })
            expect(desk.cancelApproved).not.toHaveBeenCalled()
            expect(desk.confirmApproved).not.toHaveBeenCalled()
            expect(desk.moveApproved).not.toHaveBeenCalled()
            expect(kit.text).not.toHaveBeenCalled()
        },
    )

    it("confirms the booking named by the approved proposal and records the result", async () => {
        const { service, kit, desk } = await build()
        const proposal = proposalOf({
            fields: { booking_id: "booking-2", service: "Massage", customer_name: "Mai", start_at: startAt },
        })

        await expect(service.perform(ctx, itemOf({ action: "confirm_booking" }), proposal)).resolves.toEqual({
            summary: `bookingConfirmed|Massage|Mai|${startAt}|confirmed`,
            evidence: "captured",
            lead_id: "lead-1",
        })
        expect(desk.confirmApproved).toHaveBeenCalledWith({ workspaceId: "ws-1", id: "booking-2" })
        expect(kit.text).toHaveBeenCalledWith(ctx, "bookingConfirmed", {
            service: "Massage",
            name: "Mai",
            start: startAt,
            status: "confirmed",
        })
        expect(desk.cancelApproved).not.toHaveBeenCalled()
        expect(desk.moveApproved).not.toHaveBeenCalled()
    })

    it("reports the current status when confirmation leaves the booking unchanged", async () => {
        const { service, kit, desk } = await build()
        desk.confirmApproved.mockResolvedValue({ status: "cancelled", feeDue: false })

        await expect(service.perform(ctx, itemOf({ action: "confirm_booking" }), proposalOf())).resolves.toEqual({
            summary: `bookingUnchanged|Haircut|Lan|${startAt}|cancelled`,
            evidence: "captured",
            lead_id: "lead-1",
        })
        expect(desk.confirmApproved).toHaveBeenCalledWith({ workspaceId: "ws-1", id: "booking-1" })
        expect(kit.text).toHaveBeenCalledWith(ctx, "bookingUnchanged", {
            service: "Haircut",
            name: "Lan",
            start: startAt,
            status: "cancelled",
        })
    })
})

describe("BookingPerformerService perform", () => {
    it("reads missing and null display facts as empty text and numeric facts as text", async () => {
        const { service, kit, desk } = await build()
        const proposal = proposalOf({ fields: { booking_id: 42, customer_name: null, start_at: 17 } })

        await expect(
            service.perform(ctx, itemOf({ action: "confirm_booking", lead_id: null }), proposal),
        ).resolves.toEqual({
            summary: "bookingConfirmed|||17|confirmed",
            evidence: "captured",
            lead_id: null,
        })
        expect(desk.confirmApproved).toHaveBeenCalledWith({ workspaceId: "ws-1", id: "42" })
        expect(kit.text).toHaveBeenCalledWith(ctx, "bookingConfirmed", {
            service: "",
            name: "",
            start: "17",
            status: "confirmed",
        })
    })

    it("moves an automatically approved booking without forcing a taken place", async () => {
        const { service, kit, desk } = await build()
        const proposal = proposalOf({ fields: { ...proposalOf().fields, new_start: newStart } })

        await expect(service.perform(ctx, itemOf({ action: "reschedule" }), proposal)).resolves.toEqual({
            summary: `bookingMoved|Haircut|Lan|${newStart}`,
            evidence: "captured",
            lead_id: "lead-1",
        })
        expect(desk.moveApproved).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            id: "booking-1",
            startAt: newStart,
            resourceId: "",
            force: false,
        })
        expect(kit.text).toHaveBeenCalledWith(ctx, "bookingMoved", {
            service: "Haircut",
            name: "Lan",
            start: newStart,
        })
        expect(desk.cancelApproved).not.toHaveBeenCalled()
        expect(desk.confirmApproved).not.toHaveBeenCalled()
    })

    it("allows a human-approved move to force a taken place", async () => {
        const { service, kit, desk } = await build()
        const proposal = proposalOf({ fields: { ...proposalOf().fields, new_start: newStart } })

        await expect(
            service.perform(ctx, itemOf({ action: "reschedule", decided_path: "human" }), proposal),
        ).resolves.toEqual({
            summary: `bookingMoved|Haircut|Lan|${newStart}`,
            evidence: "captured",
            lead_id: "lead-1",
        })
        expect(desk.moveApproved).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            id: "booking-1",
            startAt: newStart,
            resourceId: "",
            force: true,
        })
        expect(kit.text).toHaveBeenCalledWith(ctx, "bookingMoved", {
            service: "Haircut",
            name: "Lan",
            start: newStart,
        })
    })
})

describe("BookingPerformerService perform", () => {
    it("reports the desk refusal when a booking cannot be moved", async () => {
        const { service, kit, desk } = await build()
        desk.moveApproved.mockResolvedValue({ ok: false, reason: "closed", id: null })
        const proposal = proposalOf({ fields: { ...proposalOf().fields, new_start: newStart } })

        await expect(service.perform(ctx, itemOf({ action: "reschedule" }), proposal)).rejects.toMatchObject({
            code: WorkPerformersErrorCode.BookingNotMoved,
            params: { reason: "closed" },
        })
        expect(desk.moveApproved).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            id: "booking-1",
            startAt: newStart,
            resourceId: "",
            force: false,
        })
        expect(kit.text).not.toHaveBeenCalled()
        expect(desk.cancelApproved).not.toHaveBeenCalled()
        expect(desk.confirmApproved).not.toHaveBeenCalled()
    })

    it("uses taken as the refusal when the desk supplies no reason", async () => {
        const { service, kit, desk } = await build()
        desk.moveApproved.mockResolvedValue({ ok: false, reason: null, id: null })

        await expect(service.perform(ctx, itemOf({ action: "reschedule" }), proposalOf())).rejects.toMatchObject({
            code: WorkPerformersErrorCode.BookingNotMoved,
            params: { reason: "taken" },
        })
        expect(desk.moveApproved).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            id: "booking-1",
            startAt: "",
            resourceId: "",
            force: false,
        })
        expect(kit.text).not.toHaveBeenCalled()
    })

    it("cancels a booking using the default customer reason when none was provided", async () => {
        const { service, kit, desk } = await build()

        await expect(service.perform(ctx, itemOf(), proposalOf())).resolves.toEqual({
            summary: `bookingCancelled|Haircut|Lan|${startAt}|cancelled`,
            evidence: "captured",
            lead_id: "lead-1",
        })
        expect(desk.cancelApproved).toHaveBeenCalledWith({ workspaceId: "ws-1", id: "booking-1" }, "customer_cancelled")
        expect(kit.text).toHaveBeenCalledWith(ctx, "bookingCancelled", {
            service: "Haircut",
            name: "Lan",
            start: startAt,
            status: "cancelled",
        })
        expect(desk.confirmApproved).not.toHaveBeenCalled()
        expect(desk.moveApproved).not.toHaveBeenCalled()
    })
})

describe("BookingPerformerService perform", () => {
    it("runs a cancellation with a fee using the default reason when the given reason is blank", async () => {
        const { service, kit, desk } = await build()
        const proposal = proposalOf({ fields: { ...proposalOf().fields, reason: " \t\n " } })

        await expect(service.perform(ctx, itemOf({ action: "cancel_with_fee" }), proposal)).resolves.toEqual({
            summary: `bookingCancelled|Haircut|Lan|${startAt}|cancelled`,
            evidence: "captured",
            lead_id: "lead-1",
        })
        expect(desk.cancelApproved).toHaveBeenCalledWith({ workspaceId: "ws-1", id: "booking-1" }, "customer_cancelled")
        expect(kit.text).toHaveBeenCalledWith(ctx, "bookingCancelled", {
            service: "Haircut",
            name: "Lan",
            start: startAt,
            status: "cancelled",
        })
    })

    it("trims a supplied cancellation reason before sending it to the desk", async () => {
        const { service, kit, desk } = await build()
        const proposal = proposalOf({ fields: { ...proposalOf().fields, reason: "  Cannot attend  " } })

        await expect(service.perform(ctx, itemOf(), proposal)).resolves.toEqual({
            summary: `bookingCancelled|Haircut|Lan|${startAt}|cancelled`,
            evidence: "captured",
            lead_id: "lead-1",
        })
        expect(desk.cancelApproved).toHaveBeenCalledWith({ workspaceId: "ws-1", id: "booking-1" }, "Cannot attend")
        expect(kit.text).toHaveBeenCalledWith(ctx, "bookingCancelled", {
            service: "Haircut",
            name: "Lan",
            start: startAt,
            status: "cancelled",
        })
    })

    it("limits a supplied cancellation reason to 200 characters", async () => {
        const { service, kit, desk } = await build()
        const proposal = proposalOf({ fields: { ...proposalOf().fields, reason: `  ${"x".repeat(201)}  ` } })

        await expect(service.perform(ctx, itemOf(), proposal)).resolves.toEqual({
            summary: `bookingCancelled|Haircut|Lan|${startAt}|cancelled`,
            evidence: "captured",
            lead_id: "lead-1",
        })
        expect(desk.cancelApproved).toHaveBeenCalledWith({ workspaceId: "ws-1", id: "booking-1" }, "x".repeat(200))
        expect(kit.text).toHaveBeenCalledWith(ctx, "bookingCancelled", {
            service: "Haircut",
            name: "Lan",
            start: startAt,
            status: "cancelled",
        })
    })
})

describe("BookingPerformerService perform", () => {
    it("reports the current status when the booking cannot be cancelled", async () => {
        const { service, kit, desk } = await build()
        desk.cancelApproved.mockResolvedValue({ status: "done", feeDue: false })

        await expect(service.perform(ctx, itemOf(), proposalOf())).resolves.toEqual({
            summary: `bookingUnchanged|Haircut|Lan|${startAt}|done`,
            evidence: "captured",
            lead_id: "lead-1",
        })
        expect(desk.cancelApproved).toHaveBeenCalledWith({ workspaceId: "ws-1", id: "booking-1" }, "customer_cancelled")
        expect(kit.text).toHaveBeenCalledWith(ctx, "bookingUnchanged", {
            service: "Haircut",
            name: "Lan",
            start: startAt,
            status: "done",
        })
    })
})
