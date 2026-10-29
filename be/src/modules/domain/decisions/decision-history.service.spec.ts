import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ApprovalRequestsHistoryReadService } from "@modules/domain/approval-requests"
import type { ResolvedRequestLine } from "@modules/domain/approval-requests"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { LeadReadService } from "@modules/domain/leads"
import { ThreadWorkLinksReadService } from "@modules/domain/thread-work"
import { WorkChainsHistoryReadService } from "@modules/domain/work-chains"
import type { CompletedTask } from "@modules/domain/work-chains"
import { WorkThreadsLeadsReadService } from "@modules/domain/work-threads"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { recordOf } from "@tests/fixtures/builders/authority-rules.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { DecisionHistoryService } from "./decision-history.service"
import type { DecisionHistoryFilter } from "./decision-history.service"

const filterOf = builder<DecisionHistoryFilter>({ deciders: null, outcome: null, department: null, limit: 10 })

/** A row of the decision log as the query returns it. */
interface LoggedLine {
    readonly id: string
    readonly work_item_id: string
    readonly lead_id: string | null
    readonly department: string
    readonly action: string
    readonly decided_by: string
    readonly decidedByMemberId: string | null
    readonly decider_kind: string
    readonly outcome: string
    readonly reason: string
    readonly note: string
    readonly created_at: string
    readonly sort_key: string
}

const loggedOf = builder<LoggedLine>({
    id: "decision-1",
    work_item_id: "work-1",
    lead_id: "lead-1",
    department: "sales",
    action: "send_quote",
    decided_by: "Mai (stored)",
    decidedByMemberId: "member-1",
    decider_kind: "owner",
    outcome: "approved",
    reason: "over_authority",
    note: "Looks right",
    created_at: "2026-10-15T09:15:00.000Z",
    sort_key: "20261015091500.000000",
})

const requestOf = builder<ResolvedRequestLine>({
    id: "request-1",
    department: "accounting",
    action: "pay_bill",
    status: "expired",
    resolvedBy: null,
    chainStepId: "step-1",
    at: new Date("2026-10-16T09:15:00.000Z"),
})

const taskOf = builder<CompletedTask>({
    id: "chain-1",
    threadId: "thread-1",
    actorKind: "agent",
    actorId: "agent-1",
    action: "hand_off",
    rule: "call back",
    decidedBy: "member-2",
    at: new Date("2026-10-14T09:15:00.000Z"),
})

const build = async (logged: ReadonlyArray<unknown> = []) => {
    const em = mockEntityManager()
    const [fake] = queueQueryBuilders(em, [{ getRawMany: logged }])
    const requests = mock<ApprovalRequestsHistoryReadService>()
    const chains = mock<WorkChainsHistoryReadService>()
    const threads = mock<WorkThreadsLeadsReadService>()
    const threadWork = mock<ThreadWorkLinksReadService>()
    const rules = mock<AuthorityRulesService>()
    const agents = mock<AgentDirectoryService>()
    const members = mock<WorkspaceMemberDirectoryService>()
    const leads = mock<LeadReadService>()
    requests.resolvedPage.mockResolvedValue([])
    chains.completedTasks.mockResolvedValue([])
    chains.threadsOfSteps.mockResolvedValue([])
    threads.leadsOf.mockResolvedValue([])
    threadWork.linkedRequestIds.mockResolvedValue([])
    threadWork.workingThreadIds.mockResolvedValue([])
    rules.list.mockResolvedValue([])
    agents.cardsOf.mockResolvedValue([])
    members.byIds.mockResolvedValue([])
    leads.cardsOf.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            DecisionHistoryService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: ApprovalRequestsHistoryReadService, useValue: requests },
            { provide: WorkChainsHistoryReadService, useValue: chains },
            { provide: WorkThreadsLeadsReadService, useValue: threads },
            { provide: ThreadWorkLinksReadService, useValue: threadWork },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: WorkspaceMemberDirectoryService, useValue: members },
            { provide: LeadReadService, useValue: leads },
        ],
    }).compile()
    return {
        service: moduleRef.get(DecisionHistoryService),
        fake,
        requests,
        chains,
        threads,
        threadWork,
        rules,
        agents,
        members,
        leads,
    }
}

describe("DecisionHistoryService merging", () => {
    it("merges the three sources newest first with the names of members, customers and rules", async () => {
        const kit = await build([loggedOf()])
        kit.members.byIds.mockResolvedValue([
            { id: "member-1", displayName: "Mai", role: "owner" },
            { id: "member-2", displayName: "Binh", role: "manager" },
        ])
        kit.requests.resolvedPage.mockResolvedValue([
            requestOf(),
            requestOf({ id: "request-2", status: "approved", resolvedBy: "member-2", chainStepId: "step-2" }),
            requestOf({ id: "request-3", status: "approved", resolvedBy: "member-2", chainStepId: "step-3" }),
        ])
        kit.threadWork.linkedRequestIds.mockResolvedValue(["request-2", "request-1"])
        kit.chains.threadsOfSteps.mockResolvedValue([
            { id: "step-1", threadId: "thread-9" },
            { id: "step-3", threadId: "thread-8" },
        ])
        kit.threads.leadsOf.mockResolvedValue([
            { id: "thread-9", leadId: "lead-2" },
            { id: "thread-8", leadId: null },
            { id: "thread-1", leadId: null },
        ])
        kit.rules.list.mockResolvedValue([recordOf({ action: "pay_bill", note: "pay with care" })])
        kit.chains.completedTasks.mockResolvedValue([taskOf()])
        kit.agents.cardsOf.mockResolvedValue([{ id: "agent-1", name: "A", module: "sales", canTagAgentIds: [] }])
        kit.leads.cardsOf.mockResolvedValue([
            { id: "lead-1", contactName: "Lan", company: "", channel: "", stage: "new", email: null },
        ])

        const lines = await kit.service.list("ws-1", filterOf())

        expect(lines.map((line) => [line.id, line.decider_kind, line.decided_by, line.leadName, line.note])).toEqual([
            ["request-3", "staff", "Binh", null, "pay with care"],
            ["request-1", "policy", "NIVO", null, "pay with care"],
            ["decision-1", "owner", "Mai", "Lan", "Looks right"],
            ["chain-1", "staff", "Binh", null, "call back"],
        ])
        expect(lines[3]).toMatchObject({ department: "sales", action: "thread_task", outcome: "completed" })
    })

})

describe("DecisionHistoryService filters and passes", () => {
    it("narrows every source by decider, outcome and module", async () => {
        const kit = await build([])
        kit.members.byIds.mockResolvedValue([{ id: "member-2", displayName: "Binh", role: "staff" }])
        kit.chains.completedTasks.mockResolvedValue([taskOf(), taskOf({ id: "chain-2", actorKind: "member" })])
        kit.threads.leadsOf.mockResolvedValue([{ id: "thread-1", leadId: null }])
        kit.agents.cardsOf.mockResolvedValue([{ id: "agent-1", name: "A", module: "sales", canTagAgentIds: [] }])
        const filter = filterOf({ deciders: ["staff"], outcome: "completed", department: "office" })

        const lines = await kit.service.list("ws-1", filter)

        expect(lines.map((line) => line.id)).toEqual(["chain-2"])
        expect(kit.fake?.callsOf("andWhere").map(([sql]) => sql)).toEqual([
            "d.deciderKind IN (:...deciders)",
            "d.outcome = :outcome",
            "d.department = :department",
        ])
        expect(kit.requests.resolvedPage).toHaveBeenCalledWith("ws-1", {
            department: "office",
            status: "completed",
            skip: 0,
            limit: 10,
        })
    })

    it("reads no tasks for an outcome a task can not have, and drops tasks without member, thread or free thread", async () => {
        const kit = await build([])

        await expect(kit.service.list("ws-1", filterOf({ outcome: "rejected" }))).resolves.toEqual([])
        expect(kit.chains.completedTasks).not.toHaveBeenCalled()

        kit.members.byIds.mockResolvedValue([{ id: "member-2", displayName: "Binh", role: "staff" }])
        kit.chains.completedTasks.mockResolvedValue([
            taskOf({ id: "no-member", decidedBy: "member-gone" }),
            taskOf({ id: "no-thread", threadId: "thread-gone" }),
            taskOf({ id: "busy", threadId: "thread-busy" }),
        ])
        kit.threads.leadsOf.mockResolvedValue([
            { id: "thread-1", leadId: null },
            { id: "thread-busy", leadId: null },
        ])
        kit.threadWork.workingThreadIds.mockResolvedValue(["thread-busy"])
        await expect(kit.service.list("ws-1", filterOf())).resolves.toEqual([])
    })

    it("keeps reading passes while a source runs short of the page, and stops when it runs dry", async () => {
        const kit = await build([])
        kit.members.byIds.mockResolvedValue([{ id: "member-2", displayName: "Binh", role: "staff" }])
        kit.requests.resolvedPage
            .mockResolvedValueOnce([requestOf({ id: "a", resolvedBy: "member-2", status: "approved" })])
            .mockResolvedValueOnce([])
        kit.requests.resolvedPage.mockResolvedValue([])

        await expect(kit.service.list("ws-1", filterOf({ deciders: ["owner"], limit: 1 }))).resolves.toEqual([])
        expect(kit.requests.resolvedPage).toHaveBeenNthCalledWith(2, "ws-1", expect.objectContaining({ skip: 1 }))
    })
})
