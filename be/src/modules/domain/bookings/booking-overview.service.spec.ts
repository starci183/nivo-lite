import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { StubsOf } from "@starci/jest-preset/entity-manager"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { BookingModelService } from "./booking-model.service"
import { BookingOverviewService } from "./booking-overview.service"
import type { BookingModel } from "./bookings.contracts"
import {
    SELECT_DEPOSITS_DUE,
    SELECT_FINISHED_COUNTS,
    SELECT_OVERLAPPING_BOOKINGS,
    SELECT_WINDOW_BOOKINGS,
} from "./persistence/booking-overview.sql"
import { DEFAULT_SETTINGS } from "./persistence/booking.rows"

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

type Untyped = readonly [unknown, unknown]

const build = async <
    const S extends { readonly [M in string]?: Untyped | ReadonlyArray<Untyped> } = Record<never, never>,
>(
    stubs: S & StubsOf<S>,
    model: BookingModel = modelOf(),
) => {
    const entityManager = mockEntityManager(stubs)
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
    return { service: moduleRef.get(BookingOverviewService), access, entityManager }
}

const rowOf = (status: string, startIso: string, endIso: string, resource = "r1") => ({
    status,
    resource_id: resource,
    party_size: 1,
    price_vnd: 100000,
    start_ms: Date.parse(startIso),
    end_ms: Date.parse(endIso),
})

describe("BookingOverviewService", () => {
    describe("overview", () => {
        it("sums today, the week, the last 30 days, the deposits and the statistics of the range", async () => {
            const { service, access, entityManager } = await build({
                query: [
                    [
                        SELECT_WINDOW_BOOKINGS,
                        [
                            rowOf("confirmed", "2026-10-14T02:00:00Z", "2026-10-14T03:00:00Z"),
                            rowOf("cancelled", "2026-10-14T04:00:00Z", "2026-10-14T05:00:00Z"),
                            rowOf("done", "2026-10-13T02:00:00Z", "2026-10-13T03:00:00Z"),
                        ],
                    ],
                    [
                        SELECT_FINISHED_COUNTS,
                        [
                            { status: "done", total: 3 },
                            { status: "no_show", total: 1 },
                        ],
                    ],
                    [SELECT_DEPOSITS_DUE, [{ total: 2, amount_vnd: 150000 }]],
                    [
                        SELECT_OVERLAPPING_BOOKINGS,
                        [
                            rowOf("done", "2026-10-13T02:00:00Z", "2026-10-13T03:00:00Z"),
                            rowOf("no_show", "2026-10-13T04:00:00Z", "2026-10-13T05:00:00Z"),
                            rowOf("confirmed", "2026-10-14T02:00:00Z", "2026-10-14T03:00:00Z"),
                        ],
                    ],
                ],
            })

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
            expect(entityManager.query).toHaveBeenCalledWith(SELECT_WINDOW_BOOKINGS, [
                WORKSPACE,
                "2026-10-11T17:00:00.000Z",
                "2026-10-18T17:00:00.000Z",
                "inst-1",
            ])
        })

        it("has no shares to show for a business without resources or finished bookings", async () => {
            const { service, entityManager } = await build(
                {
                    query: [
                        [SELECT_WINDOW_BOOKINGS, []],
                        [SELECT_FINISHED_COUNTS, []],
                        [SELECT_DEPOSITS_DUE, [{ total: 0, amount_vnd: 0 }]],
                        [SELECT_OVERLAPPING_BOOKINGS, []],
                    ],
                },
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
            expect(entityManager.query).toHaveBeenCalledWith(SELECT_DEPOSITS_DUE, [WORKSPACE, null])
        })
    })
})
