import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { BookingExceptionsReadService } from "@modules/domain/booking-exceptions"
import type { BookingExceptionRecord } from "@modules/domain/booking-exceptions"
import { BookingHoursReadService } from "@modules/domain/booking-hours"
import type { BookingHourRecord } from "@modules/domain/booking-hours"
import { BookingResourcesReadService } from "@modules/domain/booking-resources"
import type { BookingResourceRecord, BookingResourceStaffLink } from "@modules/domain/booking-resources"
import { BookingServicesReadService } from "@modules/domain/booking-services"
import type { BookingServiceRecord } from "@modules/domain/booking-services"
import { BookingSettingsReadService } from "@modules/domain/booking-settings"
import type { BookingSettingRecord } from "@modules/domain/booking-settings"
import { ShiftsLeaveReadService } from "@modules/domain/shifts"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingModelService } from "./booking-model.service"
import { DEFAULT_SETTINGS } from "./bookings.contracts"
import { BookingEntity } from "./persistence/entities"

const SETTINGS: BookingSettingRecord = {
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
}

/** What the owner capabilities answer to the reads the model composes. */
interface Reads {
    readonly settings?: BookingSettingRecord | null
    readonly services?: ReadonlyArray<BookingServiceRecord>
    readonly resources?: ReadonlyArray<BookingResourceRecord>
    readonly linked?: ReadonlyArray<BookingResourceStaffLink>
    readonly hours?: ReadonlyArray<BookingHourRecord>
    readonly exceptions?: ReadonlyArray<BookingExceptionRecord>
}

const buildWith = async (entityManager: MockEntityManager, reads: Reads = {}) => {
    const leave = mock<ShiftsLeaveReadService>()
    leave.approvedLeave.mockResolvedValue([])
    const settings = mock<BookingSettingsReadService>({ of: jest.fn(() => Promise.resolve(reads.settings ?? null)) })
    const services = mock<BookingServicesReadService>({
        catalogue: jest.fn(() => Promise.resolve(reads.services ?? [])),
    })
    const resources = mock<BookingResourcesReadService>({
        catalogue: jest.fn(() => Promise.resolve(reads.resources ?? [])),
        staffLinked: jest.fn(() => Promise.resolve(reads.linked ?? [])),
    })
    const hours = mock<BookingHoursReadService>({ week: jest.fn(() => Promise.resolve(reads.hours ?? [])) })
    const exceptions = mock<BookingExceptionsReadService>({
        list: jest.fn(() => Promise.resolve(reads.exceptions ?? [])),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingModelService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ShiftsLeaveReadService, useValue: leave },
            { provide: BookingSettingsReadService, useValue: settings },
            { provide: BookingServicesReadService, useValue: services },
            { provide: BookingResourcesReadService, useValue: resources },
            { provide: BookingHoursReadService, useValue: hours },
            { provide: BookingExceptionsReadService, useValue: exceptions },
        ],
    }).compile()
    return { model: moduleRef.get(BookingModelService), leave }
}

const build = async (reads: Reads) => (await buildWith(mockEntityManager(), reads)).model

describe("BookingModelService", () => {
    describe("settings", () => {
        it("maps the saved settings", async () => {
            const model = await build({ settings: SETTINGS })

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
            const model = await build({ settings: null })

            await expect(model.settings("ws-1")).resolves.toBe(DEFAULT_SETTINGS)
        })
    })
})

describe("BookingModelService", () => {
    describe("model", () => {
        it("reads settings, services, resources, hours and exceptions together", async () => {
            const model = await build({
                settings: SETTINGS,
                services: [
                    {
                        id: "s1",
                        name: "Cut",
                        description: "",
                        durationMin: 45,
                        bufferMin: 15,
                        priceVnd: "200000",
                        resourceKind: null,
                        followupDays: null,
                        active: true,
                    },
                ],
                resources: [
                    {
                        id: "r1",
                        name: "Anna",
                        kind: "staff",
                        capacity: 1,
                        color: "#fff",
                        active: true,
                        staffId: null,
                        sortOrder: 2,
                    },
                ],
                hours: [{ resourceId: "r1", weekday: 1, startTime: "09:00:00", endTime: "17:00:00" }],
                exceptions: [
                    {
                        id: "e1",
                        resourceId: null,
                        onDate: "2026-10-12",
                        closed: true,
                        startTime: null,
                        endTime: null,
                        note: "",
                    },
                    {
                        id: "e2",
                        resourceId: "r1",
                        onDate: "2026-10-13",
                        closed: false,
                        startTime: "10:00:00",
                        endTime: "12:00:00",
                        note: "",
                    },
                ],
            })

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
            })
            const { model, leave } = await buildWith(entityManager, {
                linked: [
                    { id: "r2", staffId: "p1" },
                    { id: "r3", staffId: "p2" },
                    { id: "r4", staffId: null },
                ],
            })
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
