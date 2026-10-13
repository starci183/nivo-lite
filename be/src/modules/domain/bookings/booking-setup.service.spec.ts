import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { BookingExceptionsService } from "@modules/domain/booking-exceptions"
import { BookingHoursService } from "@modules/domain/booking-hours"
import { BookingResourcesService } from "@modules/domain/booking-resources"
import { BookingServicesService } from "@modules/domain/booking-services"
import { BookingSettingsService } from "@modules/domain/booking-settings"
import { BookingWaitlistService } from "@modules/domain/booking-waitlist"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type {
    SaveBookingExceptionParams,
    SaveBookingPolicyParams,
    SaveBookingResourceParams,
    SaveBookingServiceParams,
} from "./booking-setup.contracts"
import { BookingSetupService } from "./booking-setup.service"
import { BookingsErrorCode } from "./errors/bookings.error"

const USER = "user-1"
const WORKSPACE = "0b5d3f4e-1c2a-4b6d-8e7f-9a0b1c2d3e4f"
const RESOURCE = "1c6e4a5f-2d3b-4c7e-9f80-ab1c2d3e4f50"
const STAFF = "2d7f5b60-3e4c-4d8f-a091-bc2d3e4f5061"
const NOW = "2026-10-12T10:00:00.000Z"

const serviceOf = builder<SaveBookingServiceParams>({
    workspaceId: WORKSPACE,
    id: null,
    name: "  Haircut ",
    description: " Wash and cut ",
    durationMin: 45,
    bufferMin: 15,
    priceVnd: 150000,
    resourceKind: "  ",
    followupDays: null,
    active: true,
})

const resourceOf = builder<SaveBookingResourceParams>({
    workspaceId: WORKSPACE,
    id: null,
    name: " Anna ",
    kind: "",
    capacity: 1,
    active: true,
    staffId: null,
})

const exceptionOf = builder<SaveBookingExceptionParams>({
    workspaceId: WORKSPACE,
    resourceId: RESOURCE,
    date: "2026-10-20",
    closed: true,
    start: "09:00",
    end: "12:00",
    note: " Holiday ",
})

const policyOf = builder<SaveBookingPolicyParams>({
    workspaceId: WORKSPACE,
    cancelWindowHours: 24,
    depositPct: 30,
    lateCancelFeePct: 50,
    noShowFeeVnd: 100000,
    minLeadMin: 60,
    maxAdvanceDays: 30,
    slotStepMin: 15,
    autoConfirm: true,
    handoffOrder: false,
    address: " 1 Le Loi ",
    timezone: "Asia/Ho_Chi_Minh",
})

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const members = mock<WorkspaceMembersService>()
    const services = mock<BookingServicesService>({ save: jest.fn(() => Promise.resolve([{ id: "svc-1" }])) })
    const resources = mock<BookingResourcesService>({
        save: jest.fn(() => Promise.resolve([{ id: RESOURCE }])),
        lock: jest.fn(() => Promise.resolve([{ id: RESOURCE }])),
        lockStaff: jest.fn(() => Promise.resolve([{ id: STAFF }])),
        used: jest.fn(() => Promise.resolve(false)),
        remove: jest.fn(() => Promise.resolve([{ id: RESOURCE }])),
    })
    const hours = mock<BookingHoursService>({
        defaults: jest.fn(() => Promise.resolve()),
        replace: jest.fn(() => Promise.resolve()),
    })
    const exceptions = mock<BookingExceptionsService>({ create: jest.fn(() => Promise.resolve([{ id: "ex-1" }])) })
    const settings = mock<BookingSettingsService>({
        savePolicy: jest.fn(() => Promise.resolve([{ id: "set-1" }])),
        slugOwner: jest.fn(() => Promise.resolve([])),
        savePublicPage: jest.fn(() => Promise.resolve([{ id: "set-1" }])),
    })
    const waitlist = mock<BookingWaitlistService>({ cancel: jest.fn(() => Promise.resolve([])) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingSetupService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BookingServicesService, useValue: services },
            { provide: BookingResourcesService, useValue: resources },
            { provide: BookingHoursService, useValue: hours },
            { provide: BookingExceptionsService, useValue: exceptions },
            { provide: BookingSettingsService, useValue: settings },
            { provide: BookingWaitlistService, useValue: waitlist },
        ],
    }).compile()
    return {
        setup: moduleRef.get(BookingSetupService),
        tx,
        members,
        services,
        resources,
        hours,
        exceptions,
        settings,
    }
}

describe("BookingSetupService", () => {
    describe("saveService", () => {
        it("saves the trimmed service for a manager and answers its id", async () => {
            const { setup, members, services } = await build()

            await expect(setup.saveService(USER, serviceOf())).resolves.toEqual({ id: "svc-1" })

            expect(members.require).toHaveBeenCalledWith(USER, WORKSPACE, ["owner", "manager"])
            expect(services.save.mock.calls[0]?.[0]).toEqual({
                ...serviceOf({ name: "Haircut", description: "Wash and cut" }),
                resourceKind: null,
            })
        })

        it("refuses a malformed workspace, a too short duration and an empty name before writing", async () => {
            const { setup, members, services } = await build()

            for (const params of [
                serviceOf({ workspaceId: "ws-1" }),
                serviceOf({ durationMin: 2 }),
                serviceOf({ name: "   " }),
            ]) {
                await expect(setup.saveService(USER, params)).rejects.toMatchObject({
                    code: BookingsErrorCode.InvalidInput,
                })
            }
            expect(members.require).toHaveBeenCalledTimes(2)
            expect(services.save).not.toHaveBeenCalled()
        })

        it("says nothing was created when the insert answers no row", async () => {
            const { setup, services } = await build()
            services.save.mockResolvedValue([])

            await expect(setup.saveService(USER, serviceOf())).rejects.toMatchObject({
                code: BookingsErrorCode.NotCreated,
            })
        })
    })

    describe("saveResource", () => {
        it("creates a staff resource with the default week in one transaction", async () => {
            const { setup, tx, resources, hours } = await build()

            await expect(setup.saveResource(USER, resourceOf({ staffId: STAFF }))).resolves.toEqual({ id: RESOURCE })

            expect(tx.commits).toBe(1)
            expect(resources.lockStaff.mock.calls[0]?.slice(0, 2)).toEqual([WORKSPACE, STAFF])
            expect(resources.save.mock.calls[0]?.[0]).toEqual(
                resourceOf({ staffId: STAFF, name: "Anna", kind: "staff" }),
            )
            expect(hours.defaults.mock.calls[0]?.slice(0, 2)).toEqual([WORKSPACE, RESOURCE])
        })

        it("rolls back when the staff link is not in the workspace", async () => {
            const { setup, tx, resources } = await build()
            resources.lockStaff.mockResolvedValue([])

            await expect(setup.saveResource(USER, resourceOf({ staffId: STAFF }))).rejects.toMatchObject({
                code: BookingsErrorCode.CatalogNotFound,
            })
            expect(tx.rollbacks).toBe(1)
            expect(resources.save).not.toHaveBeenCalled()
        })

        it("changes an existing resource without touching its hours", async () => {
            const { setup, hours } = await build()

            await expect(setup.saveResource(USER, resourceOf({ id: RESOURCE }))).resolves.toEqual({ id: RESOURCE })
            expect(hours.defaults).not.toHaveBeenCalled()
        })
    })

    describe("removeResource", () => {
        it("retires a resource that history still references", async () => {
            const { setup, tx, resources } = await build()
            resources.used.mockResolvedValue(true)

            await expect(setup.removeResource(USER, { workspaceId: WORKSPACE, id: RESOURCE })).resolves.toEqual({
                id: RESOURCE,
            })
            expect(resources.remove.mock.calls[0]?.slice(0, 3)).toEqual([WORKSPACE, RESOURCE, true])
            expect(tx.commits).toBe(1)
        })
    })

    describe("saveHours", () => {
        it("replaces the week of an owned resource", async () => {
            const { setup, hours } = await build()
            const rows = [
                { weekday: 1, start: "09:00", end: "12:00" },
                { weekday: 1, start: "13:00", end: "17:00" },
            ]

            await expect(
                setup.saveHours(USER, { workspaceId: WORKSPACE, resourceId: RESOURCE, rows }),
            ).resolves.toEqual({ id: RESOURCE })
            expect(hours.replace.mock.calls[0]?.slice(0, 3)).toEqual([WORKSPACE, RESOURCE, rows])
        })

        it("refuses overlapping windows of one day", async () => {
            const { setup, hours } = await build()

            await expect(
                setup.saveHours(USER, {
                    workspaceId: WORKSPACE,
                    resourceId: RESOURCE,
                    rows: [
                        { weekday: 2, start: "09:00", end: "12:00" },
                        { weekday: 2, start: "11:00", end: "14:00" },
                    ],
                }),
            ).rejects.toMatchObject({ code: BookingsErrorCode.InvalidInput })
            expect(hours.replace).not.toHaveBeenCalled()
        })
    })

    describe("saveException", () => {
        it("writes a closed day without times and with the trimmed note", async () => {
            const { setup, exceptions } = await build()

            await expect(setup.saveException(USER, exceptionOf())).resolves.toEqual({ id: "ex-1" })
            expect(exceptions.create.mock.calls[0]?.[0]).toEqual({
                ...exceptionOf({ note: "Holiday" }),
                start: null,
                end: null,
            })
        })

        it("refuses a date that does not exist and an opening that ends before it starts", async () => {
            const { setup } = await build()

            for (const params of [
                exceptionOf({ date: "2026-02-30" }),
                exceptionOf({ closed: false, start: "12:00", end: "09:00" }),
            ]) {
                await expect(setup.saveException(USER, params)).rejects.toMatchObject({
                    code: BookingsErrorCode.InvalidInput,
                })
            }
        })
    })

    describe("removeWaitlistEntry", () => {
        it("says the entry was not found when it is not in the workspace", async () => {
            const { setup } = await build()

            await expect(
                setup.removeWaitlistEntry(USER, { workspaceId: WORKSPACE, id: RESOURCE }),
            ).rejects.toMatchObject({ code: BookingsErrorCode.CatalogNotFound })
        })
    })

    describe("savePolicy", () => {
        it("saves the policy with the trimmed address at the clock's instant", async () => {
            const { setup, settings } = await build()

            await expect(setup.savePolicy(USER, policyOf())).resolves.toEqual({ workspaceId: WORKSPACE })
            expect(settings.savePolicy.mock.calls[0]?.[0]).toEqual({
                ...policyOf(),
                address: "1 Le Loi",
                updatedAt: NOW,
            })
        })

        it("refuses an unknown time zone and a deposit above 100 percent", async () => {
            const { setup, settings } = await build()

            for (const params of [policyOf({ timezone: "Mars/Olympus" }), policyOf({ depositPct: 101 })]) {
                await expect(setup.savePolicy(USER, params)).rejects.toMatchObject({
                    code: BookingsErrorCode.InvalidInput,
                })
            }
            expect(settings.savePolicy).not.toHaveBeenCalled()
        })
    })

    describe("savePublicPage", () => {
        it("normalizes the slug and publishes the page", async () => {
            const { setup, settings } = await build()

            await expect(
                setup.savePublicPage(USER, { workspaceId: WORKSPACE, enabled: true, slug: " Tiem Hoa! ", note: "Hi" }),
            ).resolves.toEqual({ workspaceId: WORKSPACE })
            expect(settings.slugOwner.mock.calls[0]?.slice(0, 2)).toEqual([WORKSPACE, "tiem-hoa"])
            expect(settings.savePublicPage.mock.calls[0]?.[0]).toEqual({
                workspaceId: WORKSPACE,
                enabled: true,
                slug: "tiem-hoa",
                note: "Hi",
                updatedAt: NOW,
            })
        })

        it("refuses a slug another workspace owns, before and during the write", async () => {
            const { setup, settings } = await build()
            settings.slugOwner.mockResolvedValueOnce([{ id: "ws-2" }])
            settings.savePublicPage.mockRejectedValueOnce({ driverError: { code: "23505" } })
            const page = { workspaceId: WORKSPACE, enabled: true, slug: "tiem-hoa", note: "" }

            await expect(setup.savePublicPage(USER, page)).rejects.toMatchObject({ code: BookingsErrorCode.SlugTaken })
            await expect(setup.savePublicPage(USER, page)).rejects.toMatchObject({ code: BookingsErrorCode.SlugTaken })
        })

        it("refuses to publish a page without a slug", async () => {
            const { setup } = await build()

            await expect(
                setup.savePublicPage(USER, { workspaceId: WORKSPACE, enabled: true, slug: " ", note: "" }),
            ).rejects.toMatchObject({ code: BookingsErrorCode.InvalidInput })
        })
    })
})
