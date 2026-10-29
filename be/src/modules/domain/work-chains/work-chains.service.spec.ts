import { FakeClock, fakeTransaction, mock } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentDirectoryService } from "@modules/domain/agents"
import { EventsService } from "@modules/domain/events"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { WorkChainsErrorCode } from "./errors/work-chains.error"
import {
    anyFunction,
    answersOf,
    chainedWith,
    insertedValues,
    managerOf,
    rowOf,
    stepOf,
    threadOf,
} from "@tests/fixtures/builders/work-chains.builder"
import { writeExpressionOf } from "@tests/fixtures/builders/write-expression.builder"
import {
    activeMembersOf,
    approval,
    catalogText,
    decidedHistory,
    mixedActorHistory,
    namedMemberOf,
    OWNER_FACTS,
    twelveSteps,
} from "@tests/fixtures/builders/work-chains-spec.builder"
import { WorkChainEntity } from "./persistence/entities"
import { CHAIN_OWNER_DIRECTORY } from "./work-chains.decorators"
import type { ChainOwnerDirectory } from "./work-chains.port"
import { WorkChainsService } from "./work-chains.service"

const build = async (em: MockEntityManager) => {
    fakeTransaction(em)
    const answers = answersOf(em)
    const thread = answers.thread === undefined ? threadOf() : answers.thread
    const threads = mock<WorkThreadsService>()
    threads.lockIfAny.mockResolvedValue(thread)
    threads.findIfAny.mockResolvedValue(thread)
    const agents = mock<AgentDirectoryService>()
    agents.cardsOf.mockResolvedValue([{ id: "agent-1", name: "AI Sales", module: "sales", canTagAgentIds: [] }])
    const members = mock<WorkspaceMemberDirectoryService>()
    members.byIds.mockResolvedValue([])
    members.activeAmong.mockResolvedValue(activeMembersOf(answers.active))
    members.idOfUser.mockResolvedValue((answers.workspace ?? [{ id: "boss-1" }])[0]?.id ?? null)
    members.find.mockResolvedValue(namedMemberOf(answers.name))
    const workspaces = mock<WorkspacesService>()
    workspaces.ownerIdOf.mockResolvedValue("boss-user")
    const events = mock<EventsService>()
    events.record.mockResolvedValue(undefined)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation(catalogText)
    const owners = mock<ChainOwnerDirectory>()
    owners.ownerOf.mockResolvedValue(OWNER_FACTS)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkChainsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-10-22T10:30:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CHAIN_OWNER_DIRECTORY, useValue: owners },
            { provide: EventsService, useValue: events },
            { provide: WorkThreadsService, useValue: threads },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: WorkspaceMemberDirectoryService, useValue: members },
            { provide: WorkspacesService, useValue: workspaces },
        ],
    }).compile()
    return { service: moduleRef.get(WorkChainsService), events, owners, catalog, threads, agents, members, workspaces }
}

describe("WorkChainsService > record", () => {
    it("stores the first step of a chain and writes it into the evidence log", async () => {
        const harness = managerOf()
        const { service, events, threads, agents } = await build(harness.em)

        const recorded = await service.record(stepOf())

        expect(recorded).toMatchObject({ verdict: "continue", stopReason: null, ownerTag: null })
        expect(recorded.step).toMatchObject({ id: "step-9", action: "Take the booking" })
        const insert = chainedWith(harness, "insert")
        expect(harness.em.createQueryBuilder).toHaveBeenCalledWith(WorkChainEntity, "w")
        expect(insert?.callsOf("insert")).toEqual([[]])
        expect(insert?.callsOf("values")).toEqual([[insertedValues()]])
        expect(insert?.callsOf("setParameter")).toEqual([["seqThreadId", "thread-1"]])
        expect(insert?.callsOf("returning")).toEqual([["id"]])
        expect(threads.lockIfAny).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1")
        expect(agents.cardsOf).toHaveBeenCalledWith("ws-1", ["agent-1"])
        expect(harness.steps.callsOf("andWhere")).toEqual([
            ["s.thread_id = :threadId", { threadId: "thread-1" }],
            ["s.id = :stepId", { stepId: "step-9" }],
        ])
        expect(harness.steps.callsOf("orderBy")).toEqual([["s.seq", "ASC"]])
        expect(harness.steps.callsOf("limit")).toEqual([[500], [1]])
        expect(events.record).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                kind: "work_chain.step",
                actor: "AI Sales",
                summary: "Take the booking",
                leadId: "lead-1",
                evidence: null,
            },
            expect.anything(),
        )
    })

    it("takes the next place and the end instant from the database", async () => {
        const harness = managerOf()
        const { service } = await build(harness.em)

        await service.record(stepOf())

        const [values] = chainedWith(harness, "insert")?.callsOf("values")[0] ?? []
        expect(writeExpressionOf(values, "seq")).toContain("max(seq)")
        expect(writeExpressionOf(values, "finishedAt")).toBe("now()")
    })

    it("keeps the detail of a step as evidence", async () => {
        const { service, events } = await build(managerOf({ stored: [rowOf({ detail: "2 nights villa" })] }).em)

        await service.record(stepOf({ detail: "2 nights villa" }))

        expect(events.record).toHaveBeenCalledWith(
            expect.objectContaining({ evidence: "2 nights villa" }),
            expect.anything(),
        )
    })

    it("joins the transaction of the caller when it hands one", async () => {
        const harness = managerOf()
        const { service } = await build(harness.em)

        await service.record(stepOf(), harness.em)

        expect(harness.em.transaction).not.toHaveBeenCalled()
        expect(chainedWith(harness, "insert")?.callsOf("values")).toHaveLength(1)
    })
})

describe("WorkChainsService > record by step kind", () => {
    it("makes an approval step wait on its request", async () => {
        const harness = managerOf()
        const { service } = await build(harness.em)

        await service.record(
            stepOf({
                kind: "ask_approval",
                rule: "Discount: ask first 3-15%",
                target: { kind: "group", id: "role:manager" },
                approvalRequestId: "req-1",
            }),
        )

        expect(chainedWith(harness, "insert")?.callsOf("values")).toEqual([
            [
                insertedValues({
                    kind: "ask_approval",
                    rule: "Discount: ask first 3-15%",
                    target: { kind: "group", id: "role:manager" },
                    approvalRequestId: "req-1",
                    status: "waiting",
                    finishedAt: null,
                }),
            ],
        ])
    })

    it.each([
        {
            step: { kind: "hand_off", target: { kind: "agent", id: "agent-2" } },
            stored: { status: "waiting", finishedAt: null },
        },
        {
            step: { kind: "hand_off", target: { kind: "group", id: "role:staff" } },
            stored: { status: "done", finishedAt: anyFunction() },
        },
        { step: { kind: "assign" }, stored: { status: "done" } },
    ] as const)("stores the $step.kind step aimed at $step.target.kind as $stored.status", async ({ step, stored }) => {
        const harness = managerOf()
        const { service } = await build(harness.em)

        await service.record(stepOf(step))

        expect(chainedWith(harness, "insert")?.callsOf("values")[0]?.[0]).toMatchObject({
            kind: step.kind,
            ...stored,
        })
    })
})

describe("WorkChainsService > record refusals", () => {
    it.each([
        { answers: { thread: null }, code: WorkChainsErrorCode.ThreadNotFound },
        { answers: { inserted: [] }, code: WorkChainsErrorCode.NotStored },
        { answers: { stored: [] }, code: WorkChainsErrorCode.NotStored },
    ])("refuses a step when $answers ends in $code", async ({ answers, code }) => {
        const { service } = await build(managerOf(answers).em)

        await expect(service.record(stepOf())).rejects.toMatchObject({ code })
    })
})

describe("WorkChainsService > record when the limits stop the chain", () => {
    it("sends the thirteenth automatic step back to the owner of the agent", async () => {
        const harness = managerOf({ history: twelveSteps })
        const { service, events } = await build(harness.em)

        const recorded = await service.record(stepOf())

        expect(recorded).toMatchObject({
            verdict: "stopped",
            stopReason: "limit",
            ownerTag: { kind: "member", id: "owner-1" },
        })
        expect(chainedWith(harness, "insert")?.callsOf("values")).toEqual([
            [
                insertedValues({
                    kind: "hand_off",
                    detail: 'chain.stopped.limit|{"max":12}',
                    target: { kind: "member", id: "owner-1" },
                    status: "stopped",
                }),
            ],
        ])
        expect(events.record).toHaveBeenCalledTimes(1)
    })

    it("stops a pair that keeps handing the same work to each other", async () => {
        const handOff = (id: string, seq: number, from: string, to: string) =>
            rowOf({
                id,
                seq,
                actor_id: from,
                kind: "hand_off",
                action: "Check invoice",
                target: { kind: "agent", id: to },
            })
        const history = [handOff("s1", 1, "agent-1", "agent-2"), handOff("s2", 2, "agent-2", "agent-1")]
        const { service } = await build(managerOf({ history }).em)

        const recorded = await service.record(
            stepOf({ kind: "hand_off", action: "Check invoice", target: { kind: "agent", id: "agent-2" } }),
        )

        expect(recorded).toMatchObject({ verdict: "stopped", stopReason: "loop" })
    })
})

describe("WorkChainsService > record: who a stopped chain goes back to", () => {
    it.each([
        {
            why: "the owner left the workspace",
            answers: { active: [{ id: "fallback-1" }] },
            accountOwner: "boss-user",
            id: "fallback-1",
        },
        {
            why: "neither the owner nor the fallback is active",
            answers: { active: [] },
            accountOwner: "boss-user",
            id: "boss-1",
        },
        {
            why: "the workspace has no owner account",
            answers: { active: [] },
            accountOwner: null,
            id: "fallback-1",
        },
        {
            why: "the workspace has no owner row at all",
            answers: { active: [], workspace: [] },
            accountOwner: "boss-user",
            id: "fallback-1",
        },
    ])("tags $id when $why", async ({ answers, accountOwner, id }) => {
        const { service, workspaces } = await build(managerOf({ history: twelveSteps, ...answers }).em)
        workspaces.ownerIdOf.mockResolvedValue(accountOwner)

        await expect(service.record(stepOf())).resolves.toMatchObject({ ownerTag: { kind: "member", id } })
    })
})

describe("WorkChainsService > view", () => {
    it("reads the steps in order with their summary", async () => {
        const { service } = await build(managerOf({ history: decidedHistory }).em)

        const view = await service.view("ws-1", "thread-1")

        expect(view.steps.map((step) => step.id)).toEqual(["s1", "s2"])
        expect(view.summary).toEqual({ steps: 2, humanDecisions: 1, minutes: 4, state: "complete" })
    })
})

describe("WorkChainsService > view: who acted", () => {
    it("names a member who acted by display name and role, and an unknown actor as empty", async () => {
        const { service, members } = await build(managerOf({ history: mixedActorHistory }).em)
        members.byIds.mockResolvedValue([{ id: "minh", displayName: "Mr Minh", role: "owner" }])

        const view = await service.view("ws-1", "thread-1")

        expect(view.steps.map((step) => [step.actorName, step.actorRole])).toEqual([
            ["Mr Minh", "owner"],
            ["", ""],
            ["", ""],
        ])
        expect(members.byIds).toHaveBeenCalledWith("ws-1", ["minh", "gone"], expect.anything())
    })
})

describe("WorkChainsService > linkApproval and abandon", () => {
    it("ties the approval step to its request", async () => {
        const { em } = managerOf()
        const { service } = await build(em)

        await service.linkApproval("ws-1", "step-1", "req-1")

        expect(em.update).toHaveBeenCalledWith(
            WorkChainEntity,
            { workspaceId: "ws-1", id: "step-1", kind: "ask_approval", status: "waiting" },
            { approvalRequestId: "req-1" },
        )
    })

    it("joins the transaction of the caller when it hands one", async () => {
        const { em } = managerOf()
        const { service } = await build(em)
        const other = managerOf().em

        await service.linkApproval("ws-1", "step-1", "req-1", other)

        expect(other.update).toHaveBeenCalledWith(
            WorkChainEntity,
            { workspaceId: "ws-1", id: "step-1", kind: "ask_approval", status: "waiting" },
            { approvalRequestId: "req-1" },
        )
        expect(em.update).not.toHaveBeenCalled()
    })

    it("ends a waiting step whose request could not be opened", async () => {
        const { em } = managerOf()
        const { service } = await build(em)

        await service.abandon("ws-1", "step-1")

        expect(em.update).toHaveBeenCalledWith(
            WorkChainEntity,
            { workspaceId: "ws-1", id: "step-1", status: "waiting" },
            { status: "stopped", finishedAt: anyFunction() },
        )
        expect(writeExpressionOf(em.update.mock.calls[0]?.[2], "finishedAt")).toBe("now()")
    })
})

describe("WorkChainsService > settleFor", () => {
    it("ends the hand-offs that waited on the one who answered", async () => {
        const harness = managerOf()
        const { service } = await build(harness.em)

        await service.settleFor("ws-1", "thread-1", { kind: "member", id: "van" })

        const update = chainedWith(harness, "update")
        expect(harness.em.createQueryBuilder).toHaveBeenCalledWith(WorkChainEntity, "w")
        expect(update?.callsOf("update")).toEqual([[]])
        expect(update?.callsOf("set")).toEqual([[{ status: "done", finishedAt: anyFunction(), decidedBy: "van" }]])
        expect(writeExpressionOf(update?.callsOf("set")[0]?.[0], "finishedAt")).toBe("now()")
        expect(update?.callsOf("where")[0]?.[1]).toEqual({
            workspaceId: "ws-1",
            threadId: "thread-1",
            actorKind: "member",
            actorId: "van",
        })
        expect(update?.callsOf("where")[0]?.[0]).toContain("kind IN ('hand_off', 'assign')")
    })

    it("joins the transaction of the caller when it hands one", async () => {
        const { em } = managerOf()
        const { service } = await build(em)
        const other = managerOf()

        await service.settleFor("ws-1", "thread-1", { kind: "agent", id: "agent-2" }, other.em)

        const update = chainedWith(other, "update")
        expect(update?.callsOf("set")).toEqual([[{ status: "done", finishedAt: anyFunction() }]])
        expect(update?.callsOf("where")[0]?.[1]).toMatchObject({ actorKind: "agent", actorId: "agent-2" })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("WorkChainsService > settleApproval", () => {
    it("settles an approved request as done and says who approved in the evidence log", async () => {
        const harness = managerOf()
        const em = harness.em
        const { service, events, threads, members } = await build(em)

        await service.settleApproval(approval("approved", "minh"))

        const update = chainedWith(harness, "update")
        expect(update?.callsOf("set")).toEqual([[{ status: "done", decidedBy: "minh", finishedAt: anyFunction() }]])
        expect(writeExpressionOf(update?.callsOf("set")[0]?.[0], "finishedAt")).toBe("now()")
        expect(update?.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND approval_request_id = :requestId AND kind = 'ask_approval' AND status = 'waiting'",
                { workspaceId: "ws-1", requestId: "req-1" },
            ],
        ])
        expect(update?.callsOf("returning")).toEqual([["thread_id, action"]])
        expect(threads.findIfAny).toHaveBeenCalledWith("ws-1", "thread-1", expect.anything())
        expect(members.find).toHaveBeenCalledWith("ws-1", "minh", expect.anything())
        expect(events.record).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                kind: "work_chain.approval",
                actor: "Mr Minh",
                summary: 'chain.approval.approved|{"name":"Mr Minh","action":"Approve 8%"}',
                leadId: "lead-1",
            },
            expect.anything(),
        )
        expect(em.transaction).toHaveBeenCalledTimes(1)
    })

    it("settles an expired request with nobody as the decider", async () => {
        const harness = managerOf()
        const em = harness.em
        const { service, events } = await build(em)

        await service.settleApproval(approval("expired", null, "en"))

        expect(chainedWith(harness, "update")?.callsOf("set")).toEqual([
            [{ status: "expired", decidedBy: null, finishedAt: anyFunction() }],
        ])
        expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ actor: "" }), expect.anything())
    })
})

describe("WorkChainsService > settleApproval, transactions and gaps", () => {
    it("joins the caller's transaction when it hands one, and opens its own otherwise", async () => {
        const harness = managerOf()
        const { service } = await build(harness.em)
        const { em: callers } = managerOf()

        await service.settleApproval(approval("approved", "minh"), callers)

        expect(harness.em.transaction).not.toHaveBeenCalled()
        expect(callers.createQueryBuilder).toHaveBeenCalled()
    })

    it.each([
        {
            why: "the member is gone",
            answers: { name: [] },
            decision: approval("rejected", "gone"),
            recorded: { actor: "" },
        },
        {
            why: "the thread is gone",
            answers: { thread: null },
            decision: approval("approved", "minh"),
            recorded: { leadId: null },
        },
    ])("records the evidence without what is gone when $why", async ({ answers, decision, recorded }) => {
        const { service, events } = await build(managerOf(answers).em)

        await service.settleApproval(decision)

        expect(events.record).toHaveBeenCalledWith(expect.objectContaining(recorded), expect.anything())
    })

    it("writes nothing when no waiting step belongs to the request", async () => {
        const { service, events } = await build(managerOf({ settled: [] }).em)

        await service.settleApproval(approval("approved", "minh"))

        expect(events.record).not.toHaveBeenCalled()
    })
})
