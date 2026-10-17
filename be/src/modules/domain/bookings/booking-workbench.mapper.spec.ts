import { Test } from "@nestjs/testing"
import type { BookingBoard } from "./booking-board.contracts"
import type { BookingDeskDraft, BookingServiceDraft } from "./booking-workbench.contracts"
import {
    toAddBookingRequest,
    toAddBookingType,
    toBookingBoardRequest,
    toBookingBoardType,
    toMoveBookingType,
    toSaveBookingExceptionRequest,
    toSaveBookingResourceRequest,
    toSaveBookingServiceRequest,
} from "./booking-workbench.mapper"
import { BookingsErrorCode } from "./errors/bookings.error"
import { DEFAULT_SETTINGS } from "./persistence/booking.rows"
const SUBJECT = Symbol("booking-workbench.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    toBookingBoardRequest,
                    toBookingBoardType,
                    toAddBookingRequest,
                    toSaveBookingServiceRequest,
                    toSaveBookingResourceRequest,
                    toSaveBookingExceptionRequest,
                    toAddBookingType,
                    toMoveBookingType,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./booking-workbench.mapper")>(SUBJECT)
}

const DESK: BookingDeskDraft = {
    serviceId: "service-1",
    name: "Mai",
    party: 2,
    date: "2026-10-14",
    time: "09:00",
    force: false,
    conversationId: "conversation-1",
    leadId: "lead-1",
}

const SERVICE: BookingServiceDraft = {
    name: "Haircut",
    description: "A visit",
    durationMin: 30,
    bufferMin: 5,
    resourceKind: "chair",
    active: true,
}

describe("booking workbench mapper", () => {
    describe("toBookingBoardRequest", () => {
        it.each([undefined, {}, { from: null, to: null }])("omits an absent range %p", async (draft) => {
            const subject = await build()

            expect(subject.toBookingBoardRequest("ws-1", draft)).toEqual({ workspaceId: "ws-1" })
        })

        it("preserves both explicitly supplied dates and the caller's workspace", async () => {
            const subject = await build()

            expect(subject.toBookingBoardRequest("ws-1", { from: "2026-10-12", to: "2026-10-18" })).toEqual({
                workspaceId: "ws-1",
                from: "2026-10-12",
                to: "2026-10-18",
            })
        })
    })

    describe("toBookingBoardType", () => {
        it("projects each status count and preserves every other board field", async () => {
            const subject = await build()

            const board: BookingBoard = {
                timezone: "Asia/Ho_Chi_Minh",
                today: "2026-10-14",
                nowMs: 12345,
                from: "2026-10-12",
                to: "2026-10-18",
                settings: DEFAULT_SETTINGS,
                services: [],
                resources: [],
                hours: [{ resourceId: "resource-1", weekday: 3, start: "09:00", end: "17:00" }],
                exceptions: [],
                bookings: [],
                waitlist: [],
                staff: [{ id: "staff-1", name: "Mai" }],
                figures: {
                    bookingsToday: 3,
                    noShowPct30d: 10,
                    finished30d: 20,
                    utilisationPct: 25,
                    depositsPending: 1,
                    depositsPendingVnd: 10000,
                },
                stats: {
                    byResource: [{ resourceId: "resource-1", name: "Chair", openMin: 60, bookedMin: 15, pct: 25 }],
                    byStatus: { confirmed: 2, waiting: 0, done: 1 },
                    noShowPct: 0,
                    doneRevenueVnd: 50000,
                    total: 3,
                },
            }

            expect(subject.toBookingBoardType(board)).toEqual({
                ...board,
                stats: {
                    ...board.stats,
                    byStatus: [
                        { status: "confirmed", count: 2 },
                        { status: "waiting", count: 0 },
                        { status: "done", count: 1 },
                    ],
                },
            })
            expect(board.stats.byStatus).toEqual({ confirmed: 2, waiting: 0, done: 1 })
        })
    })
})

describe("booking workbench mapper", () => {
    describe("request defaults", () => {
        it.each([{}, { resourceId: null, phone: null, note: null }])("defaults desk details %p", async (details) => {
            const subject = await build()

            expect(subject.toAddBookingRequest("ws-1", { ...DESK, ...details })).toEqual({
                ...DESK,
                workspaceId: "ws-1",
                resourceId: "",
                phone: "",
                note: "",
            })
        })

        it("keeps supplied desk details and chat links", async () => {
            const subject = await build()

            const draft = { ...DESK, resourceId: "resource-1", phone: "0901234567", note: "Window seat" }
            expect(subject.toAddBookingRequest("ws-1", draft)).toEqual({ ...draft, workspaceId: "ws-1" })
        })

        it.each([{}, { id: null, priceVnd: null, followupDays: null }])(
            "defaults service options %p",
            async (options) => {
                const subject = await build()

                expect(subject.toSaveBookingServiceRequest("ws-1", { ...SERVICE, ...options })).toEqual({
                    ...SERVICE,
                    workspaceId: "ws-1",
                    id: null,
                    priceVnd: null,
                    followupDays: null,
                })
            },
        )

        it("preserves existing service identity and zero-valued price and follow-up", async () => {
            const subject = await build()

            const draft = { ...SERVICE, id: "service-1", priceVnd: 0, followupDays: 0 }
            expect(subject.toSaveBookingServiceRequest("ws-1", draft)).toEqual({ ...draft, workspaceId: "ws-1" })
        })

        it.each([{}, { id: null, staffId: null }])("defaults resource identities %p", async (identities) => {
            const subject = await build()

            expect(
                subject.toSaveBookingResourceRequest("ws-1", {
                    name: "Chair",
                    kind: "chair",
                    capacity: 2,
                    active: false,
                    ...identities,
                }),
            ).toEqual({
                workspaceId: "ws-1",
                id: null,
                staffId: null,
                name: "Chair",
                kind: "chair",
                capacity: 2,
                active: false,
            })
        })
    })
})

describe("booking workbench mapper", () => {
    describe("request defaults", () => {
        it("keeps an existing resource's staff link", async () => {
            const subject = await build()

            const draft = {
                id: "resource-1",
                staffId: "staff-1",
                name: "Mai",
                kind: "staff",
                capacity: 1,
                active: true,
            }
            expect(subject.toSaveBookingResourceRequest("ws-1", draft)).toEqual({ ...draft, workspaceId: "ws-1" })
        })

        it.each([undefined, null, "resource-1"])("maps exception scope %p", async (resourceId) => {
            const subject = await build()

            const draft = { date: "2026-10-14", closed: true, start: "", end: "", note: "Holiday", resourceId }
            expect(subject.toSaveBookingExceptionRequest("ws-1", draft)).toEqual({
                ...draft,
                workspaceId: "ws-1",
                resourceId: resourceId ?? null,
            })
        })
    })
})

describe("booking workbench mapper", () => {
    describe.each([
        ["add", "toAddBookingType"],
        ["move", "toMoveBookingType"],
    ] as const)("%s placement", (_name, method) => {
        it("returns the identity of a successful placement", async () => {
            const subject = await build()
            const project = subject[method]

            expect(project({ ok: true, id: "booking-1", reason: null })).toEqual({ id: "booking-1" })
        })

        it.each([
            ["service_required", BookingsErrorCode.ServiceRequired],
            ["name_required", BookingsErrorCode.NameRequired],
            ["datetime_invalid", BookingsErrorCode.DateTimeInvalid],
            ["service_not_found", BookingsErrorCode.ServiceNotFound],
            ["closed", BookingsErrorCode.Closed],
            ["full", BookingsErrorCode.Full],
            ["no_resource", BookingsErrorCode.NoResource],
            ["taken", BookingsErrorCode.Taken],
            ["not_movable", BookingsErrorCode.NotMovable],
            ["resource_not_found", BookingsErrorCode.ResourceNotFound],
        ] as const)("promotes %s to its domain error", async (reason, code) => {
            const subject = await build()
            const project = subject[method]

            expect(() => project({ ok: false, id: null, reason })).toThrow(expect.objectContaining({ code }))
        })

        it.each([false, true])("rejects an absent identity when ok is %p", async (ok) => {
            const subject = await build()
            const project = subject[method]

            expect(() => project({ ok, id: null, reason: null })).toThrow(
                expect.objectContaining({ code: BookingsErrorCode.NotCreated }),
            )
        })
    })
})
