import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ApprovalRequestsHistoryReadService } from "@modules/domain/approval-requests"
import type { ResolvedRequestLine } from "@modules/domain/approval-requests"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { LeadReadService } from "@modules/domain/leads"
import { WorkspaceMemberDirectoryService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import { recordOf } from "@tests/fixtures/builders/authority-rules.builder"
import type { DecisionHistoryRequest, HistoryCompletedTask } from "./decision-history.contracts"
import { DecisionHistoryService } from "./decision-history.service"
import { DecisionLogReadService } from "./decision-log-read.service"
import type { DecisionLogRow } from "./decision-log.rows"
import { THREAD_WORK_HISTORY, WORK_CHAINS_HISTORY, WORK_THREADS_HISTORY } from "./work-engine.decorators"
import type { ThreadWorkHistory, WorkChainsHistory, WorkThreadsHistory } from "./work-engine.port"

const queryOf = builder<DecisionHistoryRequest>({ kind: "all", department: null, limit: 10 })

const loggedOf = builder<DecisionLogRow>({
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

const taskOf = builder<HistoryCompletedTask>({
    id: "chain-1",
    threadId: "thread-1",
    actorKind: "agent",
    actorId: "agent-1",
    action: "hand_off",
    rule: "call back",
    decidedBy: "member-2",
    at: new Date("2026-10-14T09:15:00.000Z"),
})

const build = async (logged: ReadonlyArray<Partial<DecisionLogRow>> = []) => {
    const log = mock<DecisionLogReadService>()
    log.lines.mockResolvedValue(logged.map((line) => loggedOf(line)))
    const access = mock<WorkspaceMembersService>()
    const requests = mock<ApprovalRequestsHistoryReadService>()
    const chains = mock<WorkChainsHistory>()
    const threads = mock<WorkThreadsHistory>()
    const threadWork = mock<ThreadWorkHistory>()
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
            { provide: DecisionLogReadService, useValue: log },
            { provide: WorkspaceMembersService, useValue: access },
            { provide: ApprovalRequestsHistoryReadService, useValue: requests },
            { provide: WORK_CHAINS_HISTORY, useValue: chains },
            { provide: WORK_THREADS_HISTORY, useValue: threads },
            { provide: THREAD_WORK_HISTORY, useValue: threadWork },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: WorkspaceMemberDirectoryService, useValue: members },
            { provide: LeadReadService, useValue: leads },
        ],
    }).compile()
    return {
        service: moduleRef.get(DecisionHistoryService),
        log,
        access,
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
        const kit = await build([{}])
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

        const lines = await kit.service.list("user-1", "ws-1", queryOf())

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
    it("proves the membership and narrows every source by kind, module and a bounded page", async () => {
        const kit = await build([])
        kit.members.byIds.mockResolvedValue([{ id: "member-2", displayName: "Binh", role: "staff" }])
        kit.chains.completedTasks.mockResolvedValue([taskOf(), taskOf({ id: "chain-2", actorKind: "member" })])
        kit.threads.leadsOf.mockResolvedValue([{ id: "thread-1", leadId: null }])
        kit.agents.cardsOf.mockResolvedValue([{ id: "agent-1", name: "A", module: "sales", canTagAgentIds: [] }])

        const lines = await kit.service.list(
            "user-1",
            "ws-1",
            queryOf({ kind: "human", department: "office", limit: 1000 }),
        )

        expect(lines.map((line) => line.id)).toEqual(["chain-2"])
        expect(kit.access.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(kit.log.lines).toHaveBeenCalledWith("ws-1", {
            deciders: ["owner", "staff"],
            outcome: null,
            department: "office",
            limit: 100,
        })
        expect(kit.requests.resolvedPage).toHaveBeenCalledWith("ws-1", {
            department: "office",
            status: null,
            skip: 0,
            limit: 100,
        })
    })

    it("reads the policy and the rejected kinds as their own deciders and outcome", async () => {
        const kit = await build([])

        await kit.service.list("user-1", "ws-1", queryOf({ kind: "policy" }))
        await expect(kit.service.list("user-1", "ws-1", queryOf({ kind: "rejected" }))).resolves.toEqual([])

        expect(kit.log.lines).toHaveBeenNthCalledWith(1, "ws-1", {
            deciders: ["policy"],
            outcome: null,
            department: null,
            limit: 10,
        })
        expect(kit.log.lines).toHaveBeenNthCalledWith(2, "ws-1", {
            deciders: null,
            outcome: "rejected",
            department: null,
            limit: 10,
        })
    })
})

describe("DecisionHistoryService task and pass edges", () => {
    it("reads no tasks for an outcome a task can not have, and drops tasks without member, thread or free thread", async () => {
        const kit = await build([])

        await expect(kit.service.list("user-1", "ws-1", queryOf({ kind: "rejected" }))).resolves.toEqual([])
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
        await expect(kit.service.list("user-1", "ws-1", queryOf())).resolves.toEqual([])
    })

    it("keeps reading passes while a source runs short of the page, and stops when it runs dry", async () => {
        const kit = await build([])
        kit.members.byIds.mockResolvedValue([{ id: "member-2", displayName: "Binh", role: "staff" }])
        kit.requests.resolvedPage
            .mockResolvedValueOnce([requestOf({ id: "a", resolvedBy: "member-2", status: "approved" })])
            .mockResolvedValueOnce([])
        kit.requests.resolvedPage.mockResolvedValue([])

        await expect(kit.service.list("user-1", "ws-1", queryOf({ kind: "policy", limit: 1 }))).resolves.toEqual([])
        expect(kit.requests.resolvedPage).toHaveBeenNthCalledWith(2, "ws-1", expect.objectContaining({ skip: 1 }))
    })
})

describe("DecisionHistoryService fallbacks", () => {
    it("keeps the stored name of a line nobody can be named for, and reads an owner's request without a thread or a rule", async () => {
        const kit = await build([
            { id: "no-member", decidedByMemberId: null },
            { id: "gone-member", decidedByMemberId: "member-gone" },
        ])
        kit.members.byIds.mockResolvedValue([{ id: "member-1", displayName: "Mai", role: "owner" }])
        kit.requests.resolvedPage.mockResolvedValue([
            requestOf({ id: "owned", status: "approved", resolvedBy: "member-1", chainStepId: "step-lost" }),
        ])

        const lines = await kit.service.list("user-1", "ws-1", queryOf())

        const stored = lines.filter((line) => line.id !== "owned").map((line) => line.decided_by)
        expect(stored).toEqual(["Mai (stored)", "Mai (stored)"])
        expect(lines.find((line) => line.id === "owned")).toMatchObject({
            decider_kind: "owner",
            decided_by: "Mai",
            lead_id: null,
            note: "",
        })
    })

    it("names a task by its action when it has no rule, and drops a task whose decider the filter does not want", async () => {
        const kit = await build([])
        kit.members.byIds.mockResolvedValue([{ id: "member-2", displayName: "Binh", role: "staff" }])
        kit.chains.completedTasks.mockResolvedValue([taskOf({ rule: null })])
        kit.threads.leadsOf.mockResolvedValue([{ id: "thread-1", leadId: null }])

        const everyone = await kit.service.list("user-1", "ws-1", queryOf())
        const policyOnly = await kit.service.list("user-1", "ws-1", queryOf({ kind: "policy" }))

        expect(everyone.map((line) => [line.id, line.note])).toEqual([["chain-1", "hand_off"]])
        expect(policyOnly).toEqual([])
    })
})
