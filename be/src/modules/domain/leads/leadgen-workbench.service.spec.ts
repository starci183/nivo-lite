import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LeadGenWorkbenchService } from "./leadgen-workbench.service"
import {
    LIST_LEADGEN_CONVERSATIONS,
    LIST_LEADGEN_ITEMS,
    LIST_LEADGEN_LEADS,
    LIST_LEADGEN_MESSAGES,
} from "./persistence/leadgen-workbench.sql"

const NOW = Date.parse("2026-10-12T03:00:00.000Z")
const SINCE = new Date(NOW - 90 * 86_400_000).toISOString()

const build = async () => {
    const em = mockEntityManager({
        query: [
            [LIST_LEADGEN_LEADS, []],
            [LIST_LEADGEN_ITEMS, []],
            [LIST_LEADGEN_CONVERSATIONS, []],
            [LIST_LEADGEN_MESSAGES, []],
        ],
    })
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "An",
        status: "active",
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadGenWorkbenchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { bench: moduleRef.get(LeadGenWorkbenchService), em, members }
}

describe("LeadGenWorkbenchService", () => {
    it("answers an empty workbench for a workspace with no lead-gen rows", async () => {
        const { bench, em, members } = await build()

        await expect(bench.read("user-1", "ws-1", null)).resolves.toEqual({
            metrics: {
                newToday: 0,
                hotWaiting: 0,
                firstReplyP50Min: null,
                firstReplySample: 0,
                conversionWindowDays: 90,
                conversionLeads: 0,
                conversionWon: 0,
            },
            leads: [],
            leadsHidden: 0,
            sources: [],
            comments: [],
            handoffs: [],
        })

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(em.query).toHaveBeenCalledWith(LIST_LEADGEN_MESSAGES, ["ws-1", SINCE])
    })
})
