import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { BookingExceptionsReadService } from "@modules/domain/booking-exceptions"
import { BookingHoursReadService } from "@modules/domain/booking-hours"
import { BookingResourcesReadService } from "@modules/domain/booking-resources"
import { BookingServicesReadService } from "@modules/domain/booking-services"
import { BookingWaitlistReadService } from "@modules/domain/booking-waitlist"
import type { BookingWaitRecord } from "@modules/domain/booking-waitlist"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { StaffDirectoryService } from "@modules/domain/staff"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingBoardService } from "./booking-board.service"
import type { BoardBookingFacts } from "./booking-facts.contracts"
import { BookingModelService } from "./booking-model.service"
import { BookingOverviewService } from "./booking-overview.service"
import { DEFAULT_SETTINGS } from "./bookings.contracts"
import type { BookingOverview } from "./bookings.contracts"
import { BookingsErrorCode } from "./errors/bookings.error"

const WORKSPACE = "ws-1"
const USER = "user-1"
/** Wednesday 12:00 in Ho Chi Minh City. */
const NOW = Date.UTC(2026, 9, 14, 5, 0)

const OVERVIEW: BookingOverview = {
    figures: {
        bookingsToday: 1,
        noShowPct30d: null,
        finished30d: 0,
        utilisationPct: null,
        depositsPending: 0,
        depositsPendingVnd: 0,
    },
    stats: { byResource: [], byStatus: {}, noShowPct: 0, doneRevenueVnd: 0, total: 0 },
}

const BOOKING: Omit<BoardBookingFacts, "service_name"> = {
    id: "b-1",
    customer_name: "Mai",
    customer_phone: "0900",
    service_id: "svc-1",
    resource_id: "r-1",
    start_ms: Date.UTC(2026, 9, 14, 2, 0),
    end_ms: Date.UTC(2026, 9, 14, 3, 0),
    status: "confirmed",
    holds_slot: true,
    party_size: 1,
    price_vnd: 150000,
    deposit_vnd: 0,
    deposit_status: "none",
    cancel_fee_vnd: 0,
    checked_in: false,
    note: "",
    conflict_note: "",
    source_channel: "website",
    lead_id: null,
    reschedule_count: 0,
}

/** A manager whose query builder answers the bookings of the week. */
const boardManager = () => {
    const em = mockEntityManager()
    const bookings = fakeQueryBuilder({ getRawMany: [BOOKING] })
    em.createQueryBuilder.mockReturnValueOnce(bookings.builder)
    return { em, bookings }
}

const WAITING: BookingWaitRecord = {
    id: "w-1",
    customerName: "Lan",
    customerPhone: null,
    serviceId: "svc-1",
    windowStart: new Date(NOW),
    windowEnd: new Date(NOW + 3_600_000),
    partySize: 2,
    status: "waiting",
}

const build = async (entityManager: MockEntityManager, waiting: ReadonlyArray<BookingWaitRecord> = []) => {
    const servicesRead = mock<BookingServicesReadService>({
        catalogue: jest.fn(() => Promise.resolve([])),
        namesOf: jest.fn(() => Promise.resolve(new Map([["svc-1", "Haircut"]]))),
    })
    const resourcesRead = mock<BookingResourcesReadService>({ catalogue: jest.fn(() => Promise.resolve([])) })
    const hoursRead = mock<BookingHoursReadService>({ week: jest.fn(() => Promise.resolve([])) })
    const exceptionsRead = mock<BookingExceptionsReadService>({ list: jest.fn(() => Promise.resolve([])) })
    const waitlistRead = mock<BookingWaitlistReadService>({ open: jest.fn(() => Promise.resolve(waiting)) })
    const members = mock<WorkspaceMembersService>()
    const models = mock<BookingModelService>({ settings: jest.fn(() => Promise.resolve(DEFAULT_SETTINGS)) })
    const overview = mock<BookingOverviewService>({ overview: jest.fn(() => Promise.resolve(OVERVIEW)) })
    const staff = mock<StaffDirectoryService>({
        list: jest.fn(() =>
            Promise.resolve([
                { id: "s-2", name: "Anna" },
                { id: "s-1", name: "Anna" },
            ]),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingBoardService,
            { provide: StaffDirectoryService, useValue: staff },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BookingModelService, useValue: models },
            { provide: BookingOverviewService, useValue: overview },
            { provide: BookingServicesReadService, useValue: servicesRead },
            { provide: BookingResourcesReadService, useValue: resourcesRead },
            { provide: BookingHoursReadService, useValue: hoursRead },
            { provide: BookingExceptionsReadService, useValue: exceptionsRead },
            { provide: BookingWaitlistReadService, useValue: waitlistRead },
        ],
    }).compile()
    return { service: moduleRef.get(BookingBoardService), members, overview, exceptionsRead, servicesRead }
}

describe("BookingBoardService", () => {
    describe("board", () => {
        it("reads this week and places bookings on the workspace's local clock", async () => {
            const { em, bookings } = boardManager()
            const { service, members, overview, exceptionsRead } = await build(em, [WAITING])

            const board = await service.board(USER, { workspaceId: WORKSPACE })

            expect(board).toMatchObject({
                timezone: "Asia/Ho_Chi_Minh",
                today: "2026-10-14",
                nowMs: NOW,
                from: "2026-10-12",
                to: "2026-10-18",
                staff: [
                    { id: "s-1", name: "Anna" },
                    { id: "s-2", name: "Anna" },
                ],
                figures: OVERVIEW.figures,
                stats: OVERVIEW.stats,
            })
            expect(board.waitlist).toEqual([
                {
                    id: "w-1",
                    customer: "Lan",
                    phone: null,
                    service: "Haircut",
                    fromMs: NOW,
                    toMs: NOW + 3_600_000,
                    party: 2,
                    status: "waiting",
                },
            ])
            expect(board.bookings).toEqual([
                expect.objectContaining({
                    id: "b-1",
                    service: "Haircut",
                    customer: "Mai",
                    date: "2026-10-14",
                    startMin: 540,
                    endMin: 600,
                    endClock: "10:00",
                }),
            ])
            expect(members.require).toHaveBeenCalledWith(USER, WORKSPACE)
            expect(bookings.callsOf("where")).toEqual([
                [
                    "b.workspaceId = :workspaceId AND b.startAt < :to AND b.endAt > :from",
                    {
                        workspaceId: WORKSPACE,
                        from: new Date("2026-10-11T17:00:00.000Z"),
                        to: new Date("2026-10-18T17:00:00.000Z"),
                    },
                ],
            ])
            expect(exceptionsRead.list).toHaveBeenCalledWith(WORKSPACE, "2026-10-12")
            expect(overview.overview).toHaveBeenCalledWith(USER, {
                workspaceId: WORKSPACE,
                from: "2026-10-12",
                to: "2026-10-18",
            })
        })
    })
})

describe("BookingBoardService", () => {
    describe("board", () => {
        it("reads exceptions from yesterday when the range starts later", async () => {
            const { em } = boardManager()
            const { service, exceptionsRead } = await build(em)

            const board = await service.board(USER, { workspaceId: WORKSPACE, from: "2026-10-20", to: "2026-10-20" })

            expect(board).toMatchObject({ from: "2026-10-20", to: "2026-10-20" })
            expect(exceptionsRead.list).toHaveBeenCalledWith(WORKSPACE, "2026-10-13")
        })

        it("refuses invalid dates, reversed ranges and ranges longer than a year", async () => {
            const { service } = await build(boardManager().em)

            for (const range of [
                { from: "2026-02-30" },
                { from: "2026-10-20", to: "2026-10-19" },
                { from: "2026-01-01", to: "2027-01-02" },
            ]) {
                await expect(service.board(USER, { workspaceId: WORKSPACE, ...range })).rejects.toMatchObject({
                    code: BookingsErrorCode.InvalidInput,
                })
            }
        })

        it("reads nothing for someone who is not a member", async () => {
            const { em } = boardManager()
            const { service, members, servicesRead } = await build(em)
            const refusal = new Error("not a member")
            members.require.mockRejectedValue(refusal)

            await expect(service.board(USER, { workspaceId: WORKSPACE })).rejects.toBe(refusal)
            expect(servicesRead.catalogue).not.toHaveBeenCalled()
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
})

describe("BookingBoardService", () => {
    describe("board", () => {
        it.each([
            { from: "tomorrow" },
            { from: "2026-13-01" },
            { from: "2026-10-14", to: "tomorrow" },
            { from: "9999-12-31", to: "9999-12-31" },
        ])("rejects an invalid or unbounded calendar window %j before reading rows", async (range) => {
            const em = mockEntityManager()
            const { service, overview, servicesRead } = await build(em)

            await expect(service.board(USER, { workspaceId: WORKSPACE, ...range })).rejects.toMatchObject({
                code: BookingsErrorCode.InvalidInput,
            })
            expect(servicesRead.catalogue).not.toHaveBeenCalled()
            expect(overview.overview).not.toHaveBeenCalled()
        })
    })
})
