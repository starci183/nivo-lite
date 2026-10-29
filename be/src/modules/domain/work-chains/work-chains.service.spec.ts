import { FakeClock, fakeTransaction, mock } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EventsService } from "@modules/domain/events"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { WorkChainsErrorCode } from "./errors/work-chains.error"
import { WorkThreadEntity } from "@modules/domain/work-threads"
import { chainedWith, insertedValues, managerOf, rowOf, stepOf } from "@tests/fixtures/builders/work-chains.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { WorkChainEntity } from "./persistence/entities"
import { CHAIN_OWNER_DIRECTORY } from "./work-chains.decorators"
import type { ChainOwnerDirectory } from "./work-chains.port"
import { WorkChainsService } from "./work-chains.service"

const build = async (em: MockEntityManager) => {
    fakeTransaction(em)
    const events = mock<EventsService>({ record: jest.fn().mockResolvedValue(undefined) })
    const catalog = mock<MessageCatalog>({
        get: jest.fn(
            (key: string, params: Readonly<Record<string, string | number>>) => `${key}|${JSON.stringify(params)}`,
        ),
    })
    const owners = mock<ChainOwnerDirectory>({
        ownerOf: jest.fn().mockResolvedValue({ ownerMemberId: "owner-1", fallbackMemberId: "fallback-1" }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkChainsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-10-22T10:30:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CHAIN_OWNER_DIRECTORY, useValue: owners },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return { service: moduleRef.get(WorkChainsService), events, owners, catalog }
}

const registerFirstSteps = () => {
    describe("record", () => {
        it("stores the first step of a chain and writes it into the evidence log", async () => {
            const harness = managerOf()
            const { service, events } = await build(harness.em)

            const recorded = await service.record(stepOf())

            expect(recorded).toMatchObject({ verdict: "continue", stopReason: null, ownerTag: null })
            expect(recorded.step).toMatchObject({ id: "step-9", action: "Take the booking" })
            const insert = chainedWith(harness, "insert")
            expect(harness.em.createQueryBuilder).toHaveBeenCalledWith(WorkChainEntity, "w")
            expect(insert?.callsOf("insert")).toEqual([[]])
            expect(insert?.callsOf("values")).toEqual([[insertedValues()]])
            expect(insert?.callsOf("setParameter")).toEqual([["seqThreadId", "thread-1"]])
            expect(insert?.callsOf("returning")).toEqual([["id"]])
            expect(harness.em.findOne).toHaveBeenCalledWith(WorkThreadEntity, {
                select: { id: true, leadId: true },
                where: { workspaceId: "ws-1", id: "thread-1" },
                lock: { mode: "pessimistic_write" },
            })
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
}

const registerStepKinds = () => {
    describe("record by step kind", () => {
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

        it("makes a hand-off to an agent wait until that agent answers", async () => {
            const harness = managerOf()
            const { service } = await build(harness.em)

            await service.record(stepOf({ kind: "hand_off", target: { kind: "agent", id: "agent-2" } }))

            expect(chainedWith(harness, "insert")?.callsOf("values")[0]?.[0]).toMatchObject({
                kind: "hand_off",
                status: "waiting",
                finishedAt: null,
            })
        })

        it("ends a hand-off to a group at once, since no one person answers it", async () => {
            const harness = managerOf()
            const { service } = await build(harness.em)

            await service.record(stepOf({ kind: "hand_off", target: { kind: "group", id: "role:staff" } }))

            expect(evaluatedValues(chainedWith(harness, "insert")?.callsOf("values")[0]?.[0])).toMatchObject({
                kind: "hand_off",
                status: "done",
                seq: "(SELECT coalesce(max(seq), 0) + 1 FROM public.work_chains WHERE thread_id = :seqThreadId)",
                finishedAt: "now()",
            })
        })

        it("ends a hand-off that tags nobody at once", async () => {
            const harness = managerOf()
            const { service } = await build(harness.em)

            await service.record(stepOf({ kind: "assign" }))

            expect(chainedWith(harness, "insert")?.callsOf("values")[0]?.[0]).toMatchObject({
                kind: "assign",
                status: "done",
            })
        })
    })
}

const registerRefusals = () => {
    describe("record refusals", () => {
        it("refuses a thread that is not in the workspace", async () => {
            const { service } = await build(managerOf({ thread: null }).em)

            await expect(service.record(stepOf())).rejects.toMatchObject({ code: WorkChainsErrorCode.ThreadNotFound })
        })

        it("refuses a step the insert did not answer", async () => {
            const { service } = await build(managerOf({ inserted: [] }).em)

            await expect(service.record(stepOf())).rejects.toMatchObject({ code: WorkChainsErrorCode.NotStored })
        })

        it("refuses a step that cannot be read back", async () => {
            const { service } = await build(managerOf({ stored: [] }).em)

            await expect(service.record(stepOf())).rejects.toMatchObject({ code: WorkChainsErrorCode.NotStored })
        })
    })
}

const twelveSteps = Array.from({ length: 12 }, (_, index) =>
    rowOf({ id: `s${index}`, seq: index + 1, actor_id: `a${index}` }),
)

const registerLimitStops = () => {
    describe("record when the limits stop the chain", () => {
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
}

const registerOwnerChoice = () => {
    describe("record: who a stopped chain goes back to", () => {
        it("tags the fallback when the owner left the workspace", async () => {
            const { service } = await build(managerOf({ history: twelveSteps, active: [{ id: "fallback-1" }] }).em)

            await expect(service.record(stepOf())).resolves.toMatchObject({
                ownerTag: { kind: "member", id: "fallback-1" },
            })
        })

        it("tags the workspace owner when neither the owner nor the fallback is active", async () => {
            const { service } = await build(managerOf({ history: twelveSteps, active: [] }).em)

            await expect(service.record(stepOf())).resolves.toMatchObject({
                ownerTag: { kind: "member", id: "boss-1" },
            })
        })

        it("tags the fallback when the workspace has no owner row at all", async () => {
            const { service } = await build(managerOf({ history: twelveSteps, active: [], workspace: [] }).em)

            await expect(service.record(stepOf())).resolves.toMatchObject({
                ownerTag: { kind: "member", id: "fallback-1" },
            })
        })
    })
}

const registerView = () => {
    describe("view", () => {
        it("reads the steps in order with their summary", async () => {
            const history = [
                rowOf({ id: "s1", seq: 1 }),
                rowOf({
                    id: "s2",
                    seq: 2,
                    kind: "ask_approval",
                    decided_by: "owner-1",
                    started_at: new Date("2026-10-22T09:41:00+07:00"),
                    finished_at: new Date("2026-10-22T09:45:00+07:00"),
                }),
            ]
            const { service } = await build(managerOf({ history }).em)

            const view = await service.view("ws-1", "thread-1")

            expect(view.steps.map((step) => step.id)).toEqual(["s1", "s2"])
            expect(view.summary).toEqual({ steps: 2, humanDecisions: 1, minutes: 4, state: "complete" })
        })
    })
}

const registerApprovalLinks = () => {
    describe("linkApproval and abandon", () => {
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

            expect(em.update.mock.calls[0]?.slice(0, 2)).toEqual([
                WorkChainEntity,
                { workspaceId: "ws-1", id: "step-1", status: "waiting" },
            ])
            expect(evaluatedValues(em.update.mock.calls[0]?.[2])).toEqual({ status: "stopped", finishedAt: "now()" })
        })
    })
}

const registerSettleFor = () => {
    describe("settleFor", () => {
        it("ends the hand-offs that waited on the one who answered", async () => {
            const harness = managerOf()
            const { service } = await build(harness.em)

            await service.settleFor("ws-1", "thread-1", { kind: "member", id: "van" })

            const update = chainedWith(harness, "update")
            expect(harness.em.createQueryBuilder).toHaveBeenCalledWith(WorkChainEntity, "w")
            expect(update?.callsOf("update")).toEqual([[]])
            expect(update?.callsOf("set").map(([set]) => evaluatedValues(set))).toEqual([
                { status: "done", finishedAt: "now()", decidedBy: "van" },
            ])
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
            expect(update?.callsOf("set").map(([set]) => evaluatedValues(set))).toEqual([
                { status: "done", finishedAt: "now()" },
            ])
            expect(update?.callsOf("where")[0]?.[1]).toMatchObject({ actorKind: "agent", actorId: "agent-2" })
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
}

const approval = (
    outcome: "approved" | "rejected" | "expired",
    decidedBy: string | null,
    locale: "vi" | "en" = "vi",
) => ({
    workspaceId: "ws-1",
    approvalRequestId: "req-1",
    outcome,
    decidedBy,
    locale,
})

const registerSettleApproval = () => {
    describe("settleApproval", () => {
        it("settles an approved request as done and says who approved in the evidence log", async () => {
            const harness = managerOf()
            const em = harness.em
            const { service, events } = await build(em)

            await service.settleApproval(approval("approved", "minh"))

            const update = chainedWith(harness, "update")
            expect(update?.callsOf("set").map(([set]) => evaluatedValues(set))).toEqual([
                { status: "done", decidedBy: "minh", finishedAt: "now()" },
            ])
            expect(update?.callsOf("where")).toEqual([
                [
                    "workspace_id = :workspaceId AND approval_request_id = :requestId AND kind = 'ask_approval' AND status = 'waiting'",
                    { workspaceId: "ws-1", requestId: "req-1" },
                ],
            ])
            expect(update?.callsOf("returning")).toEqual([["thread_id, action"]])
            expect(em.findOne).toHaveBeenCalledWith(WorkThreadEntity, {
                select: { id: true, leadId: true },
                where: { id: "thread-1" },
            })
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

            expect(
                chainedWith(harness, "update")
                    ?.callsOf("set")
                    .map(([set]) => evaluatedValues(set)),
            ).toEqual([{ status: "expired", decidedBy: null, finishedAt: "now()" }])
            expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ actor: "" }), expect.anything())
        })

        it("logs no lead when the thread of the settled step is gone", async () => {
            const { service, events } = await build(managerOf({ thread: null }).em)

            await service.settleApproval(approval("approved", "minh"))

            expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ leadId: null }), expect.anything())
        })

        it("names the decider as empty when the member is gone", async () => {
            const { service, events } = await build(managerOf({ name: [] }).em)

            await service.settleApproval(approval("rejected", "gone"))

            expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ actor: "" }), expect.anything())
        })

        it("joins the caller's transaction when it hands one, and opens its own otherwise", async () => {
            const harness = managerOf()
            const { service } = await build(harness.em)
            const { em: callers } = managerOf()

            await service.settleApproval(approval("approved", "minh"), callers)

            expect(harness.em.transaction).not.toHaveBeenCalled()
            expect(callers.createQueryBuilder).toHaveBeenCalled()
        })

        it("writes nothing when no waiting step belongs to the request", async () => {
            const { service, events } = await build(managerOf({ settled: [] }).em)

            await service.settleApproval(approval("approved", "minh"))

            expect(events.record).not.toHaveBeenCalled()
        })
    })
}

describe("WorkChainsService", () => {
    registerFirstSteps()
    registerStepKinds()
    registerRefusals()
    registerLimitStops()
    registerOwnerChoice()
    registerView()
    registerApprovalLinks()
    registerSettleFor()
    registerSettleApproval()
})
