import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LeadsError, LeadsErrorCode } from "./errors/leads.error"
import { LeadGenWorkbenchService } from "./leadgen-workbench.service"
import type { LeadGenLeadRecord } from "./leadgen-workbench.contracts"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"

const NOW = Date.parse("2026-10-12T03:00:00.000Z")
const SINCE = new Date(NOW - 90 * 86_400_000).toISOString()

/** Four empty datasets, in the order the workbench reads them: leads, work items, conversations, messages. */
const EMPTY: ReadonlyArray<QueryBuilderAnswers> = [
    { getRawMany: [] },
    { getRawMany: [] },
    { getRawMany: [] },
    { getRawMany: [] },
]

const build = async (answers: ReadonlyArray<QueryBuilderAnswers> = EMPTY) => {
    const em = mockEntityManager()
    const fakes = queueQueryBuilders(em, answers)
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
    return { bench: moduleRef.get(LeadGenWorkbenchService), em, members, fakes }
}

describe("LeadGenWorkbenchService", () => {
    it("answers an empty workbench for a workspace with no lead-gen rows", async () => {
        const { bench, fakes, members } = await build()

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
        expect(fakes[3]?.callsOf("where")).toEqual([
            [
                "m.workspace_id = :workspaceId AND m.created_at >= CAST(:since AS timestamptz)",
                { workspaceId: "ws-1", since: SINCE },
            ],
        ])
    })
})

describe("LeadGenWorkbenchService", () => {
    it("reads every dataset for the authorized workspace and treats omitted installation scope as all instances", async () => {
        const normal = mock<LeadGenLeadRecord>({
            id: "normal",
            contact_name: "An",
            company: "Acme",
            channel: "facebook",
            need: "Advice",
            stage: "new",
            installation_id: "agent-2",
            created_at: "2026-10-12T02:00:00.000Z",
        })
        const testContact = mock<LeadGenLeadRecord>({ ...normal, id: "test-contact", contact_name: "UAT person" })
        const testCompany = mock<LeadGenLeadRecord>({ ...normal, id: "test-company", company: "DBG company" })
        const absentNames = Object.assign(mock<LeadGenLeadRecord>({ ...normal, id: "legacy" }), {
            contact_name: undefined,
            company: undefined,
        })
        const { bench, em, fakes } = await build([
            { getRawMany: [normal, testContact, testCompany, absentNames] },
            ...EMPTY.slice(1),
        ])

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
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(4)
        expect(fakes.map((fake) => fake.callsOf("limit"))).toEqual([[[500]], [[600]], [[1000]], [[8000]]])
        expect(fakes[1]?.callsOf("from")).toEqual([["public.work_items", "w"]])
        expect(fakes[2]?.callsOf("from")).toEqual([["public.agent_conversations", "c"]])
        expect(fakes[3]?.callsOf("from")).toEqual([["public.agent_messages", "m"]])
    })
})

describe("LeadGenWorkbenchService", () => {
    it("applies an explicit installation scope", async () => {
        const own = mock<LeadGenLeadRecord>({
            id: "own",
            contact_name: "An",
            company: "Acme",
            channel: "facebook",
            need: "Advice",
            stage: "new",
            installation_id: "agent-1",
            created_at: "2026-10-12T02:00:00.000Z",
        })
        const other = mock<LeadGenLeadRecord>({ ...own, id: "other", installation_id: "agent-2" })
        const { bench } = await build([{ getRawMany: [own, other] }, ...EMPTY.slice(1)])

        const result = await bench.read("user-1", "ws-1", "agent-1")

        expect(result.leads.map((lead) => lead.id)).toEqual(["own"])
        expect(result.metrics.conversionLeads).toBe(1)
    })

    it("propagates membership refusal before reading workspace data", async () => {
        const { bench, em, members } = await build([])
        const refusal = { code: "workspace.not_member", params: { workspaceId: "ws-1" } }
        members.require.mockRejectedValueOnce(refusal)

        await expect(bench.read("outsider", "ws-1", null)).rejects.toBe(refusal)

        expect(members.require).toHaveBeenCalledWith("outsider", "ws-1")
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("propagates a failed dataset read", async () => {
        const { bench, em } = await build(EMPTY.slice(0, 1))
        const failure = new LeadsError({ code: LeadsErrorCode.NotFound, params: { id: "database" } })
        em.createQueryBuilder.mockImplementationOnce(() => {
            throw failure
        })

        await expect(bench.read("user-1", "ws-1", null)).rejects.toBe(failure)

        expect(em.createQueryBuilder).toHaveBeenCalledTimes(2)
    })
})
