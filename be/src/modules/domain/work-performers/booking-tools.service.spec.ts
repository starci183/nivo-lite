import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import type { ToolArgs, ToolContext } from "@modules/domain/agent-tools"
import { BookingPublicService } from "@modules/domain/bookings"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { BookingToolsService } from "./booking-tools.service"

const ctx: ToolContext = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1" }
const NOW = "2026-10-11T18:30:00.000Z"
const START = "2026-10-13T02:00:00.000Z"
const requestArgs: ToolArgs = { slot: START, contact_name: "Mai", contact: "0912 345 678", service: "hair" }

const serviceOf = builder<Awaited<ReturnType<BookingPublicService["catalogIn"]>>["services"][number]>({
    id: "service-1",
    name: "Haircut",
    description: "A haircut",
    durationMin: 60,
    bufferMin: 0,
    priceVnd: 200000,
    resourceKind: null,
    active: true,
})
const catalogOf = builder<Awaited<ReturnType<BookingPublicService["catalogIn"]>>>({
    timezone: "Asia/Ho_Chi_Minh",
    services: [serviceOf(), serviceOf({ id: "service-2", name: "Old", active: false })],
})
const resultOf = builder<Awaited<ReturnType<BookingPublicService["requestIn"]>>>({
    ok: true,
    state: "confirmed",
    code: "confirmed",
    serviceName: "Haircut",
    startIso: START,
    alternatives: [],
    bookingId: "booking-1",
})
const cancellableOf = builder<NonNullable<Awaited<ReturnType<BookingPublicService["nextCancellable"]>>>>({
    id: "booking-1",
    leadId: "lead-1",
    startIso: START,
    serviceName: "Haircut",
    customerName: "Mai",
})
const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "booking",
    action: "cancel_booking",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "unclear_outcome",
    reasons: ["unclear_outcome"],
    missing_fields: [],
    proposal: { summary: "Cancel Haircut for Mai", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    installation_id: null,
})

const build = async () => {
    const bookings = mock<BookingPublicService>()
    bookings.catalogIn.mockResolvedValue(catalogOf())
    bookings.freeTimesIn.mockResolvedValue({ times: [START] })
    bookings.requestIn.mockResolvedValue(resultOf())
    bookings.nextCancellable.mockResolvedValue(cancellableOf())
    const engine = mock<WorkEngineService>()
    engine.runWork.mockResolvedValue(itemOf())
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("Cancel Haircut for Mai")
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingToolsService,
            { provide: BookingPublicService, useValue: bookings },
            { provide: WorkEngineService, useValue: engine },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(BookingToolsService), bookings, engine, catalog }
}

describe("BookingToolsService booking.find_slots", () => {
    it("defaults to the shop's local day and lists each start once, capped at twenty", async () => {
        const { service, bookings } = await build()
        const times = Array.from({ length: 25 }, (_, index) =>
            new Date(Date.parse(START) + index * 60_000).toISOString(),
        )
        bookings.freeTimesIn.mockResolvedValue({ times: [START, ...times] })

        await expect(service.run(ctx, "booking.find_slots", { party_size: 3 })).resolves.toEqual({
            ok: true,
            service: "Haircut",
            timezone: "Asia/Ho_Chi_Minh",
            date: "2026-10-12",
            times: times.slice(0, 20),
        })
        expect(bookings.freeTimesIn).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            service: "service-1",
            date: "2026-10-12",
            party: 3,
        })
    })

    it("uses the requested day and resolves an active service by its partial name", async () => {
        const { service, bookings } = await build()

        await expect(service.run(ctx, "booking.find_slots", { service: "HAIR", date: "2026-10-13" })).resolves.toEqual({
            ok: true,
            service: "Haircut",
            timezone: "Asia/Ho_Chi_Minh",
            date: "2026-10-13",
            times: [START],
        })
        expect(bookings.freeTimesIn.mock.calls[0]?.[0].date).toBe("2026-10-13")
    })

    it("answers with only active names when the requested service is unavailable", async () => {
        const { service, bookings } = await build()

        await expect(service.run(ctx, "booking.find_slots", { service: "Old" })).resolves.toEqual({
            ok: false,
            reason: "service_unknown",
            services: ["Haircut"],
        })
        expect(bookings.freeTimesIn).not.toHaveBeenCalled()
    })

    it("asks which service when several are active and no name was supplied", async () => {
        const { service, bookings } = await build()
        bookings.catalogIn.mockResolvedValue(catalogOf({ services: [serviceOf(), serviceOf({ name: "Massage" })] }))

        await expect(service.run(ctx, "booking.find_slots", {})).resolves.toEqual({
            ok: false,
            reason: "service_unknown",
            services: ["Haircut", "Massage"],
        })
        expect(bookings.freeTimesIn).not.toHaveBeenCalled()
    })
})

describe("BookingToolsService booking.request", () => {
    it.each([
        resultOf(),
        resultOf({ state: "waiting", code: "received_free" }),
        resultOf({ state: "waiting", code: "received_taken", alternatives: ["2026-10-13T03:00:00.000Z"] }),
        resultOf({ ok: false, state: "failed", code: "no_resource", bookingId: null }),
    ])("maps the public placement result $code into stable chat facts", async (result) => {
        const { service, bookings } = await build()
        bookings.requestIn.mockResolvedValue(result)

        await expect(
            service.run(ctx, "booking.request", { ...requestArgs, party_size: 2, note: " first visit " }),
        ).resolves.toEqual({
            ok: result.ok,
            state: result.state,
            code: result.code,
            service: result.serviceName,
            start: result.startIso,
            alternatives: result.alternatives,
            bookingId: result.bookingId,
        })
        expect(bookings.requestIn).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            sourceChannel: "chat",
            serviceId: "service-1",
            start: START,
            name: "Mai",
            phone: "0912 345 678",
            email: "",
            party: 2,
            note: "first visit",
            token: `chat:job-1:${START}`,
        })
    })

    it.each([
        { args: { ...requestArgs, contact_name: " " }, code: "name_required" },
        { args: { ...requestArgs, contact: "123" }, code: "phone_invalid" },
        { args: { ...requestArgs, contact: undefined }, code: "phone_invalid" },
        { args: { ...requestArgs, slot: "tomorrow" }, code: "start_invalid" },
        { args: { ...requestArgs, slot: "2026-10-13" }, code: "start_invalid" },
    ])("answers $code without placing an invalid request", async ({ args, code }) => {
        const { service, bookings } = await build()

        await expect(service.run(ctx, "booking.request", args)).resolves.toEqual({
            ok: false,
            state: "invalid",
            code,
            service: "",
            start: "",
            alternatives: [],
            bookingId: null,
        })
        expect(bookings.requestIn).not.toHaveBeenCalled()
        expect(bookings.catalogIn).not.toHaveBeenCalled()
    })

    it("answers service_unavailable with active names without placing a request", async () => {
        const { service, bookings } = await build()

        await expect(service.run(ctx, "booking.request", { ...requestArgs, service: "Old" })).resolves.toEqual({
            ok: false,
            state: "invalid",
            code: "service_unavailable",
            service: "",
            start: "",
            alternatives: [],
            bookingId: null,
            services: ["Haircut"],
        })
        expect(bookings.requestIn).not.toHaveBeenCalled()
    })
})

describe("BookingToolsService booking.request", () => {
    it("uses the same chat idempotency token on retries of the requested slot", async () => {
        const { service, bookings } = await build()

        const first = await service.run(ctx, "booking.request", requestArgs)
        const repeated = await service.run(ctx, "booking.request", requestArgs)

        expect(repeated).toEqual(first)
        expect(repeated.bookingId).toBe("booking-1")
        expect(bookings.requestIn.mock.calls.map(([request]) => request.token)).toEqual([
            `chat:job-1:${START}`,
            `chat:job-1:${START}`,
        ])
    })
})

describe("BookingToolsService booking.cancel", () => {
    it("opens a forced waiting decision on the customer's lead with exact booking fields", async () => {
        const { service, bookings, engine, catalog } = await build()

        await expect(
            service.run(ctx, "booking.cancel", { contact: "0912 345 678", reason: " plans changed " }),
        ).resolves.toEqual({ ok: true, state: "waiting", start: START, service: "Haircut" })
        expect(bookings.nextCancellable).toHaveBeenCalledWith("ws-1", "84912345678", Date.parse(NOW))
        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO engine", locale: "vi" },
            {
                action: "cancel_booking",
                subject_type: "lead",
                subject_id: "lead-1",
                origin: "live",
                preset: true,
                noChain: true,
                forceAsk: "unclear_outcome",
                dedupeKey: "cancel_booking:booking:booking-1",
                seed: {
                    summary: "Cancel Haircut for Mai",
                    fields: {
                        booking_id: "booking-1",
                        start_at: START,
                        service: "Haircut",
                        customer_name: "Mai",
                        reason: "plans changed",
                        conversation_id: "conv-1",
                    },
                },
            },
        )
        expect(catalog.get).toHaveBeenCalledWith(
            "performers.cancelBookingSummary",
            { service: "Haircut", name: "Mai", start: START },
            "vi",
        )
    })

    it("uses the verified conversation when the booking has no lead", async () => {
        const { service, bookings, engine } = await build()
        bookings.nextCancellable.mockResolvedValue(cancellableOf({ leadId: null }))

        await expect(service.run(ctx, "booking.cancel", { contact: "+84 912 345 678" })).resolves.toEqual({
            ok: true,
            state: "waiting",
            start: START,
            service: "Haircut",
        })
        expect(engine.runWork.mock.calls[0]?.[1]).toMatchObject({
            subject_type: "conversation",
            subject_id: "conv-1",
            seed: { fields: { reason: "", conversation_id: "conv-1" } },
        })
    })

    it("answers not_found and opens no decision when no future requested or confirmed booking exists", async () => {
        const { service, bookings, engine } = await build()
        bookings.nextCancellable.mockResolvedValue(null)

        await expect(service.run(ctx, "booking.cancel", { contact: "0912345678" })).resolves.toEqual({
            ok: false,
            reason: "not_found",
        })
        expect(engine.runWork).not.toHaveBeenCalled()
    })
})

describe("BookingToolsService booking.cancel", () => {
    it("answers not_found for an unusable phone without querying bookings", async () => {
        const { service, bookings, engine } = await build()

        await expect(service.run(ctx, "booking.cancel", { contact: "123" })).resolves.toEqual({
            ok: false,
            reason: "not_found",
        })
        expect(bookings.nextCancellable).not.toHaveBeenCalled()
        expect(engine.runWork).not.toHaveBeenCalled()
    })

    it("uses one decision dedupe key for repeated cancellation requests", async () => {
        const { service, engine } = await build()

        const first = await service.run(ctx, "booking.cancel", { contact: "0912345678" })
        const repeated = await service.run(ctx, "booking.cancel", { contact: "0912345678" })

        expect(repeated).toEqual(first)
        expect(repeated.state).toBe("waiting")
        expect(engine.runWork.mock.calls.map(([, spec]) => spec.dedupeKey)).toEqual([
            "cancel_booking:booking:booking-1",
            "cancel_booking:booking:booking-1",
        ])
    })
})
