import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LeadGenWorkbenchService } from "./leadgen-workbench.service"
import type { LeadGenLeadRow } from "./persistence/leadgen-workbench.rows"
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

    it("reads every dataset for the authorized workspace and treats omitted installation scope as all instances", async () => {
        const { bench, em } = await build()
        const normal = mock<LeadGenLeadRow>({
            id: "normal",
            contact_name: "An",
            company: "Acme",
            channel: "facebook",
            need: "Advice",
            stage: "new",
            installation_id: "agent-2",
            created_at: "2026-10-12T02:00:00.000Z",
        })
        const testContact = mock<LeadGenLeadRow>({ ...normal, id: "test-contact", contact_name: "UAT person" })
        const testCompany = mock<LeadGenLeadRow>({ ...normal, id: "test-company", company: "DBG company" })
        const absentNames = mock<LeadGenLeadRow>({
            ...normal,
            id: "legacy",
            contact_name: undefined,
            company: undefined,
        })
        em.query.mockResolvedValueOnce([normal, testContact, testCompany, absentNames])

        const result = await bench.read("user-1", "ws-1", undefined)

        expect(result.leads).toEqual([
            {
                id: "normal",
                name: "An",
                stage: "new",
                score: null,
                origin: { platform: "facebook", kind: "other", refKind: null, refId: null, refLabel: null },
                lastText: "Advice",
                lastAt: "2026-10-12T02:00:00.000Z",
                createdAt: "2026-10-12T02:00:00.000Z",
                href: "/leads/normal",
            },
            {
                id: "legacy",
                name: undefined,
                stage: "new",
                score: null,
                origin: { platform: "facebook", kind: "other", refKind: null, refId: null, refLabel: null },
                lastText: "Advice",
                lastAt: "2026-10-12T02:00:00.000Z",
                createdAt: "2026-10-12T02:00:00.000Z",
                href: "/leads/legacy",
            },
        ])
        expect(result.metrics.newToday).toBe(2)
        expect(em.query).toHaveBeenCalledTimes(4)
        expect(em.query).toHaveBeenNthCalledWith(1, LIST_LEADGEN_LEADS, ["ws-1"])
        expect(em.query).toHaveBeenNthCalledWith(2, LIST_LEADGEN_ITEMS, ["ws-1"])
        expect(em.query).toHaveBeenNthCalledWith(3, LIST_LEADGEN_CONVERSATIONS, ["ws-1"])
        expect(em.query).toHaveBeenNthCalledWith(4, LIST_LEADGEN_MESSAGES, ["ws-1", SINCE])
    })

    it("applies an explicit installation scope", async () => {
        const { bench, em } = await build()
        const own = mock<LeadGenLeadRow>({
            id: "own",
            contact_name: "An",
            company: "Acme",
            channel: "facebook",
            need: "Advice",
            stage: "new",
            installation_id: "agent-1",
            created_at: "2026-10-12T02:00:00.000Z",
        })
        const other = mock<LeadGenLeadRow>({ ...own, id: "other", installation_id: "agent-2" })
        em.query.mockResolvedValueOnce([own, other])

        const result = await bench.read("user-1", "ws-1", "agent-1")

        expect(result.leads.map((lead) => lead.id)).toEqual(["own"])
        expect(result.metrics.conversionLeads).toBe(1)
    })

    it("propagates membership refusal before reading workspace data", async () => {
        const { bench, em, members } = await build()
        const refusal = { code: "workspace.not_member", params: { workspaceId: "ws-1" } }
        members.require.mockRejectedValueOnce(refusal)

        await expect(bench.read("outsider", "ws-1", null)).rejects.toBe(refusal)

        expect(members.require).toHaveBeenCalledWith("outsider", "ws-1")
        expect(em.query).not.toHaveBeenCalled()
    })

    it("propagates a failed dataset read", async () => {
        const { bench, em } = await build()
        const failure = { code: "database.unavailable" }
        em.query.mockRejectedValueOnce(failure)

        await expect(bench.read("user-1", "ws-1", null)).rejects.toBe(failure)

        expect(em.query).toHaveBeenCalledTimes(4)
    })
})
