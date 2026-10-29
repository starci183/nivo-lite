import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { ShiftsLeaveReadService } from "@modules/domain/shifts"
import type { MockEntityManager } from "@starci/jest-preset"
import { BookingExceptionEntity } from "@modules/domain/booking-exceptions"
import { BookingHourEntity } from "@modules/domain/booking-hours"
import { BookingResourceEntity } from "@modules/domain/booking-resources"
import { BookingServiceEntity } from "@modules/domain/booking-services"
import { BookingSettingEntity } from "@modules/domain/booking-settings"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingModelService } from "./booking-model.service"
import { DEFAULT_SETTINGS } from "./bookings.contracts"
import { BookingEntity } from "./persistence/entities"

const SETTINGS = Object.assign(new BookingSettingEntity(), {
    workspaceId: "ws-1",
    timezone: "Asia/Ho_Chi_Minh",
    slotStepMin: 30,
    minLeadMin: 10,
    maxAdvanceDays: 20,
    cancelWindowHours: 12,
    depositPct: 30,
    lateCancelFeePct: 50,
    noShowFeeVnd: "100000",
    autoConfirm: false,
    handoffOrder: true,
    reminderHours: [48],
    publicEnabled: true,
    publicSlug: "spa-anna",
    publicNote: "Welcome",
    address: "1 Main St",
})

const buildWith = async (entityManager: MockEntityManager) => {
    const leave = mock<ShiftsLeaveReadService>()
    leave.approvedLeave.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingModelService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ShiftsLeaveReadService, useValue: leave },
        ],
    }).compile()
    return { model: moduleRef.get(BookingModelService), leave }
}

const build = async (entityManager: MockEntityManager) => (await buildWith(entityManager)).model

describe("BookingModelService", () => {
    describe("settings", () => {
        it("maps the saved settings", async () => {
            const model = await build(mockEntityManager({ findOneBy: [BookingSettingEntity, SETTINGS] }))

            await expect(model.settings("ws-1")).resolves.toEqual({
                timezone: "Asia/Ho_Chi_Minh",
                slotStepMin: 30,
                minLeadMin: 10,
                maxAdvanceDays: 20,
                cancelWindowHours: 12,
                depositPct: 30,
                lateCancelFeePct: 50,
                noShowFeeVnd: 100000,
                autoConfirm: false,
                handoffOrder: true,
                reminderHours: [48],
                publicEnabled: true,
                publicSlug: "spa-anna",
                publicNote: "Welcome",
                address: "1 Main St",
            })
        })

        it("falls back to the defaults of a workspace that never saved any", async () => {
            const model = await build(mockEntityManager({ findOneBy: [BookingSettingEntity, null] }))

            await expect(model.settings("ws-1")).resolves.toBe(DEFAULT_SETTINGS)
        })
    })
})

describe("BookingModelService", () => {
    describe("model", () => {
        it("reads settings, services, resources, hours and exceptions together", async () => {
            const model = await build(
                mockEntityManager({
                    findOneBy: [BookingSettingEntity, SETTINGS],
                    find: [
                        [
                            BookingServiceEntity,
                            [
                                Object.assign(new BookingServiceEntity(), {
                                    id: "s1",
                                    name: "Cut",
                                    description: "",
                                    durationMin: 45,
                                    bufferMin: 15,
                                    priceVnd: "200000",
                                    resourceKind: null,
                                    followupDays: null,
                                    active: true,
                                }),
                            ],
                        ],
                        [
                            BookingResourceEntity,
                            [
                                Object.assign(new BookingResourceEntity(), {
                                    id: "r1",
                                    name: "Anna",
                                    kind: "staff",
                                    capacity: 1,
                                    active: true,
                                    sortOrder: 2,
                                }),
                            ],
                        ],
                        [
                            BookingHourEntity,
                            [
                                Object.assign(new BookingHourEntity(), {
                                    resourceId: "r1",
                                    weekday: 1,
                                    startTime: "09:00:00",
                                    endTime: "17:00:00",
                                }),
                            ],
                        ],
                        [
                            BookingExceptionEntity,
                            [
                                Object.assign(new BookingExceptionEntity(), {
                                    resourceId: null,
                                    onDate: "2026-10-12",
                                    closed: true,
                                    startTime: null,
                                    endTime: null,
                                }),
                                Object.assign(new BookingExceptionEntity(), {
                                    resourceId: "r1",
                                    onDate: "2026-10-13",
                                    closed: false,
                                    startTime: "10:00:00",
                                    endTime: "12:00:00",
                                }),
                            ],
                        ],
                    ],
                }),
            )

            const result = await model.model("ws-1")

            expect(result.services).toEqual([
                {
                    id: "s1",
                    name: "Cut",
                    description: "",
                    durationMin: 45,
                    bufferMin: 15,
                    priceVnd: 200000,
                    resourceKind: null,
                    active: true,
                },
            ])
            expect(result.resources).toEqual([
                { id: "r1", name: "Anna", kind: "staff", capacity: 1, active: true, sort: 2 },
            ])
            expect(result.hours).toEqual([{ resourceId: "r1", weekday: 1, start: "09:00", end: "17:00" }])
            expect(result.exceptions).toEqual([
                { resourceId: null, date: "2026-10-12", closed: true, start: null, end: null },
                { resourceId: "r1", date: "2026-10-13", closed: false, start: "10:00", end: "12:00" },
            ])
            expect(result.settings.slotStepMin).toBe(30)
        })
    })
})

describe("BookingModelService", () => {
    describe("spans", () => {
        it("joins the held bookings with the whole-day blocks of approved leave", async () => {
            const entityManager = mockEntityManager({
                find: [
                    [
                        BookingEntity,
                        [
                            Object.assign(new BookingEntity(), {
                                id: "b1",
                                resourceId: "r1",
                                partySize: 2,
                                startAt: new Date(1000),
                                blockEndAt: new Date(2000),
                            }),
                        ],
                    ],
                    [
                        BookingResourceEntity,
                        [
                            Object.assign(new BookingResourceEntity(), { id: "r2", staffId: "p1" }),
                            Object.assign(new BookingResourceEntity(), { id: "r3", staffId: "p2" }),
                            Object.assign(new BookingResourceEntity(), { id: "r4", staffId: null }),
                        ],
                    ],
                ],
            })
            const { model, leave } = await buildWith(entityManager)
            leave.approvedLeave.mockResolvedValue([{ staffId: "p1", fromDate: "2026-10-12", toDate: "2026-10-12" }])
            const from = Date.UTC(2026, 9, 11, 17)

            const spans = await model.spans("ws-1", from, from + 86_400_000, "Asia/Ho_Chi_Minh")

            expect(spans).toEqual([
                { id: "b1", resourceId: "r1", startMs: 1000, blockEndMs: 2000, partySize: 2 },
                {
                    id: "leave:p1:2026-10-12",
                    resourceId: "r2",
                    startMs: Date.UTC(2026, 9, 11, 17),
                    blockEndMs: Date.UTC(2026, 9, 12, 17),
                    partySize: 1000,
                },
            ])
            const [, options] = entityManager.find.mock.calls[0] ?? []
            expect(JSON.stringify(options)).toContain("2026-10-12T17:00:00.000Z")
            expect(JSON.stringify(options)).toContain("2026-10-11T17:00:00.000Z")
            expect(leave.approvedLeave).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                staffIds: ["p1", "p2"],
                from: "2026-10-12",
                to: "2026-10-13",
            })
        })
    })
})
