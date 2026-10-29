import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { BookingModelService } from "./booking-model.service"
import { BookingOverviewService } from "./booking-overview.service"
import { DEFAULT_SETTINGS } from "./bookings.contracts"
import type { BookingModel } from "./bookings.contracts"
import { BookingEntity } from "./persistence/entities"

const WORKSPACE = "ws-1"
const USER = "user-1"
/** Wednesday 12:00 in Ho Chi Minh City. */
const NOW = Date.UTC(2026, 9, 14, 5, 0)

const modelOf = builder<BookingModel>({
    settings: { ...DEFAULT_SETTINGS, slotStepMin: 60 },
    services: [],
    resources: [{ id: "r1", name: "Anna", kind: "staff", capacity: 1, active: true, sort: 0 }],
    hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ resourceId: "r1", weekday, start: "09:00", end: "12:00" })),
    exceptions: [],
})

const build = async (
    bookings: { readonly week: Array<BookingEntity>; readonly range: Array<BookingEntity> },
    counts: { readonly finished: QueryBuilderAnswers; readonly deposits: QueryBuilderAnswers },
    model: BookingModel = modelOf(),
) => {
    const entityManager = mockEntityManager({
        find: [
            [BookingEntity, bookings.week],
            [BookingEntity, bookings.range],
        ],
    })
    const finished = fakeQueryBuilder(counts.finished)
    const deposits = fakeQueryBuilder(counts.deposits)
    entityManager.createQueryBuilder.mockReturnValueOnce(finished.builder).mockReturnValueOnce(deposits.builder)
    const access = mock<WorkspaceMembersService>()
    access.require.mockResolvedValue({
        userId: USER,
        workspaceId: WORKSPACE,
        role: "owner",
        staffId: null,
        displayName: "Owner",
        status: "active",
    })
    const models = mock<BookingModelService>()
    models.model.mockResolvedValue(model)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingOverviewService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: access },
            { provide: BookingModelService, useValue: models },
        ],
    }).compile()
    return { service: moduleRef.get(BookingOverviewService), access, entityManager, finished, deposits }
}

const rowOf = (status: string, startIso: string, endIso: string, resource = "r1"): BookingEntity =>
    Object.assign(new BookingEntity(), {
        status,
        resourceId: resource,
        partySize: 1,
        priceVnd: "100000",
        startAt: new Date(startIso),
        endAt: new Date(endIso),
    })

describe("BookingOverviewService", () => {
    describe("overview", () => {
        it("sums today, the week, the last 30 days, the deposits and the statistics of the range", async () => {
            const { service, access, entityManager, finished, deposits } = await build(
                {
                    week: [
                        rowOf("confirmed", "2026-10-14T02:00:00Z", "2026-10-14T03:00:00Z"),
                        rowOf("cancelled", "2026-10-14T04:00:00Z", "2026-10-14T05:00:00Z"),
                        rowOf("done", "2026-10-13T02:00:00Z", "2026-10-13T03:00:00Z"),
                    ],
                    range: [
                        rowOf("done", "2026-10-13T02:00:00Z", "2026-10-13T03:00:00Z"),
                        rowOf("no_show", "2026-10-13T04:00:00Z", "2026-10-13T05:00:00Z"),
                        rowOf("confirmed", "2026-10-14T02:00:00Z", "2026-10-14T03:00:00Z"),
                    ],
                },
                {
                    finished: {
                        getRawMany: [
                            { status: "done", total: 3 },
                            { status: "no_show", total: 1 },
                        ],
                    },
                    deposits: { getRawOne: { total: 2, amount_vnd: 150000 } },
                },
            )

            const result = await service.overview(USER, {
                workspaceId: WORKSPACE,
                from: "2026-10-12",
                to: "2026-10-18",
                installationId: "inst-1",
            })

            expect(access.require).toHaveBeenCalledWith(USER, WORKSPACE)
            expect(result.figures).toEqual({
                bookingsToday: 1,
                noShowPct30d: 25,
                finished30d: 4,
                utilisationPct: 10,
                depositsPending: 2,
                depositsPendingVnd: 150000,
            })
            expect(result.stats).toEqual({
                byResource: [{ resourceId: "r1", name: "Anna", openMin: 1260, bookedMin: 120, pct: 10 }],
                byStatus: { done: 1, no_show: 1, confirmed: 1 },
                noShowPct: 50,
                doneRevenueVnd: 100000,
                total: 3,
            })
            const [week, range] = entityManager.find.mock.calls
            expect(week?.[0]).toBe(BookingEntity)
            expect(JSON.stringify(week?.[1])).toContain("inst-1")
            expect(JSON.stringify(week?.[1])).toContain("2026-10-11T17:00:00.000Z")
            expect(JSON.stringify(week?.[1])).toContain("2026-10-18T17:00:00.000Z")
            expect(JSON.stringify(range?.[1])).not.toContain("installationId")
            expect(finished.callsOf("andWhere")).toContainEqual([
                "b.installationId = :instance",
                { instance: "inst-1" },
            ])
            expect(deposits.callsOf("andWhere")).toContainEqual([
                "b.installationId = :instance",
                { instance: "inst-1" },
            ])
        })
    })
})

describe("BookingOverviewService", () => {
    describe("overview", () => {
        it("has no shares to show for a business without resources or finished bookings", async () => {
            const { service, deposits } = await build(
                { week: [], range: [] },
                { finished: { getRawMany: [] }, deposits: { getRawOne: { total: 0, amount_vnd: 0 } } },
                modelOf({ resources: [] }),
            )

            const result = await service.overview(USER, {
                workspaceId: WORKSPACE,
                from: "2026-10-12",
                to: "2026-10-18",
            })

            expect(result.figures).toEqual({
                bookingsToday: 0,
                noShowPct30d: null,
                finished30d: 0,
                utilisationPct: null,
                depositsPending: 0,
                depositsPendingVnd: 0,
            })
            expect(result.stats).toEqual({ byResource: [], byStatus: {}, noShowPct: 0, doneRevenueVnd: 0, total: 0 })
            expect(deposits.callsOf("andWhere")).toHaveLength(1)
        })
    })
})
