import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingBoardService } from "./booking-board.service"
import type { BookingFigures, BookingStats } from "./bookings.contracts"
import { BookingModelService } from "./booking-model.service"
import { BookingOverviewService } from "./booking-overview.service"
import { DEFAULT_SETTINGS } from "./persistence/booking.rows"
import { localDate } from "./policies/zoned-time.policy"
import {
    SELECT_BOARD_BOOKINGS,
    SELECT_BOARD_EXCEPTIONS,
    SELECT_BOARD_RESOURCES,
    SELECT_BOARD_STAFF,
    SELECT_BOARD_WAITLIST,
} from "./persistence/booking-board.sql"
import { SELECT_HOURS, SELECT_SERVICES } from "./persistence/booking-model.sql"

/** Wednesday 12:00 in Ho Chi Minh City. */
const NOW = Date.UTC(2026, 9, 14, 5, 0)
const WORKSPACE = "ws-1"
const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: WORKSPACE,
    role: "owner",
    staffId: null,
    displayName: "Owner",
    status: "active",
}
const FIGURES: BookingFigures = {
    bookingsToday: 0,
    noShowPct30d: null,
    finished30d: 0,
    utilisationPct: null,
    depositsPending: 0,
    depositsPendingVnd: 0,
}
const STATS: BookingStats = {
    byResource: [],
    byStatus: {},
    noShowPct: 0,
    doneRevenueVnd: 0,
    total: 0,
}

const build = async () => {
    const entityManager = mockEntityManager({
        query: [
            [SELECT_SERVICES, []],
            [SELECT_BOARD_RESOURCES, []],
            [SELECT_HOURS, []],
            [SELECT_BOARD_EXCEPTIONS, []],
            [SELECT_BOARD_BOOKINGS, []],
            [SELECT_BOARD_WAITLIST, []],
            [SELECT_BOARD_STAFF, []],
        ],
    })
    const members = mock<WorkspaceMembersService>()
    const models = mock<BookingModelService>()
    const overview = mock<BookingOverviewService>()
    members.require.mockResolvedValue(MEMBER)
    models.settings.mockResolvedValue(DEFAULT_SETTINGS)
    overview.overview.mockResolvedValue({ figures: FIGURES, stats: STATS })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingBoardService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BookingModelService, useValue: models },
            { provide: BookingOverviewService, useValue: overview },
        ],
    }).compile()
    return { board: moduleRef.get(BookingBoardService), members, overview }
}

describe("BookingBoardService", () => {
    it("reads an empty board for the dates a member asked for", async () => {
        const { board, members, overview } = await build()

        await expect(
            board.board("user-1", { workspaceId: WORKSPACE, from: "2026-10-12", to: "2026-10-18" }),
        ).resolves.toEqual({
            timezone: "Asia/Ho_Chi_Minh",
            today: localDate(NOW, "Asia/Ho_Chi_Minh"),
            nowMs: NOW,
            from: "2026-10-12",
            to: "2026-10-18",
            settings: DEFAULT_SETTINGS,
            services: [],
            resources: [],
            hours: [],
            exceptions: [],
            bookings: [],
            waitlist: [],
            staff: [],
            figures: FIGURES,
            stats: STATS,
        })
        expect(members.require).toHaveBeenCalledWith("user-1", WORKSPACE)
        expect(overview.overview).toHaveBeenCalledWith("user-1", {
            workspaceId: WORKSPACE,
            from: "2026-10-12",
            to: "2026-10-18",
        })
    })
})
