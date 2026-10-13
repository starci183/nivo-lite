import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { BookingExceptionsService } from "@modules/domain/booking-exceptions"
import { BookingHoursService } from "@modules/domain/booking-hours"
import { BookingResourcesService } from "@modules/domain/booking-resources"
import { BookingServicesService } from "@modules/domain/booking-services"
import { BookingSettingsService } from "@modules/domain/booking-settings"
import { BookingWaitlistService } from "@modules/domain/booking-waitlist"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingSetupService } from "./booking-setup.service"
import type { SaveBookingServiceParams } from "./booking-setup.contracts"
import { BookingsErrorCode } from "./errors/bookings.error"

const NOW = "2026-10-13T10:00:00.000Z"
const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: WORKSPACE,
    role: "manager",
    staffId: null,
    displayName: "Manager",
    status: "active",
}
const PARAMS: SaveBookingServiceParams = {
    workspaceId: WORKSPACE,
    id: null,
    name: "   ",
    description: "",
    durationMin: 30,
    bufferMin: 0,
    priceVnd: null,
    resourceKind: "",
    followupDays: null,
    active: true,
}

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingSetupService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BookingServicesService, useValue: mock<BookingServicesService>() },
            { provide: BookingResourcesService, useValue: mock<BookingResourcesService>() },
            { provide: BookingHoursService, useValue: mock<BookingHoursService>() },
            { provide: BookingExceptionsService, useValue: mock<BookingExceptionsService>() },
            { provide: BookingSettingsService, useValue: mock<BookingSettingsService>() },
            { provide: BookingWaitlistService, useValue: mock<BookingWaitlistService>() },
        ],
    }).compile()
    return moduleRef.get(BookingSetupService)
}

describe("BookingSetupService", () => {
    it("refuses a service whose name is blank", async () => {
        const setup = await build()

        await expect(setup.saveService("user-1", PARAMS)).rejects.toMatchObject({
            code: BookingsErrorCode.InvalidInput,
        })
    })
})
