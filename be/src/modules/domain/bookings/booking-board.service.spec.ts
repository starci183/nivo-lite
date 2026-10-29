import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { BookingExceptionEntity } from "@modules/domain/booking-exceptions"
import { BookingHourEntity } from "@modules/domain/booking-hours"
import { BookingResourceEntity } from "@modules/domain/booking-resources"
import { BookingServiceEntity } from "@modules/domain/booking-services"
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

const BOOKING: BoardBookingFacts = {
    id: "b-1",
    customer_name: "Mai",
    customer_phone: "0900",
    service_id: "svc-1",
    service_name: "Haircut",
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

/** A manager whose five entity reads are empty and whose two query builders answer the bookings and the waitlist. */
const boardManager = () => {
    const em = mockEntityManager({
        find: [
            [BookingServiceEntity, []],
            [BookingResourceEntity, []],
            [BookingHourEntity, []],
            [BookingExceptionEntity, []],
        ],
    })
    const bookings = fakeQueryBuilder({ getRawMany: [BOOKING] })
    const waitlist = fakeQueryBuilder({ getRawMany: [] })
    em.createQueryBuilder.mockReturnValueOnce(bookings.builder).mockReturnValueOnce(waitlist.builder)
    return { em, bookings, waitlist }
}

/** The `onDate` bound of the exceptions read. */
const exceptionsFrom = (em: MockEntityManager): unknown => {
    const call = em.find.mock.calls.find(([entity]) => entity === BookingExceptionEntity)
    return JSON.stringify(call?.[1])
}

const build = async (entityManager: MockEntityManager) => {
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
        ],
    }).compile()
    return { service: moduleRef.get(BookingBoardService), members, overview }
}

describe("BookingBoardService", () => {
    describe("board", () => {
        it("reads this week and places bookings on the workspace's local clock", async () => {
            const { em, bookings } = boardManager()
            const { service, members, overview } = await build(em)

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
            expect(board.bookings).toEqual([
                expect.objectContaining({
                    id: "b-1",
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
            expect(exceptionsFrom(em)).toContain("2026-10-12")
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
            const { service } = await build(em)

            const board = await service.board(USER, { workspaceId: WORKSPACE, from: "2026-10-20", to: "2026-10-20" })

            expect(board).toMatchObject({ from: "2026-10-20", to: "2026-10-20" })
            expect(exceptionsFrom(em)).toContain("2026-10-13")
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
            const { service, members } = await build(em)
            const refusal = new Error("not a member")
            members.require.mockRejectedValue(refusal)

            await expect(service.board(USER, { workspaceId: WORKSPACE })).rejects.toBe(refusal)
            expect(em.find).not.toHaveBeenCalled()
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
            const { service, overview } = await build(em)

            await expect(service.board(USER, { workspaceId: WORKSPACE, ...range })).rejects.toMatchObject({
                code: BookingsErrorCode.InvalidInput,
            })
            expect(em.find).not.toHaveBeenCalled()
            expect(overview.overview).not.toHaveBeenCalled()
        })
    })
})
