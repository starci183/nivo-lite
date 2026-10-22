import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EventsService } from "@modules/domain/events"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { WorkChainsErrorCode } from "./errors/work-chains.error"
import type { ChainStepRow } from "./persistence/work-chains.rows"
import {
    ABANDON_CHAIN_STEP,
    FIND_ACTIVE_MEMBER_IDS,
    FIND_ACTOR_NAME,
    FIND_CHAIN_STEP,
    FIND_WORKSPACE_OWNER,
    INSERT_CHAIN_STEP,
    LINK_APPROVAL_STEP,
    LIST_CHAIN_STEPS,
    LOCK_CHAIN_THREAD,
    SETTLE_APPROVAL_STEP,
    SETTLE_TARGETED_STEPS,
} from "./persistence/work-chains.sql"
import type { NewChainStep } from "./work-chains.contracts"
import { CHAIN_OWNER_DIRECTORY } from "./work-chains.decorators"
import type { ChainOwnerDirectory } from "./work-chains.port"
import { WorkChainsService } from "./work-chains.service"

const rowOf = (overrides: Partial<ChainStepRow> = {}): ChainStepRow => ({
    id: "step-1",
    seq: 1,
    actor_kind: "agent",
    actor_id: "agent-1",
    actor_name: "AI Sales",
    actor_role: "sales",
    kind: "self",
    action: "Take the booking",
    detail: "",
    rule: null,
    target: null,
    approval_request_id: null,
    status: "done",
    decided_by: null,
    started_at: "2026-10-22T09:41:00+07:00",
    finished_at: "2026-10-22T09:41:00+07:00",
    ...overrides,
})

const stepOf = (overrides: Partial<NewChainStep> = {}): NewChainStep => ({
    workspaceId: "ws-1",
    threadId: "thread-1",
    actor: { kind: "agent", id: "agent-1" },
    kind: "self",
    action: "Take the booking",
    detail: "",
    rule: null,
    target: null,
    approvalRequestId: null,
    locale: "vi",
    ...overrides,
})

interface Answers {
    readonly thread?: ReadonlyArray<unknown>
    readonly history?: ReadonlyArray<ChainStepRow>
    readonly inserted?: ReadonlyArray<unknown>
    readonly stored?: ReadonlyArray<ChainStepRow>
    readonly active?: ReadonlyArray<unknown>
    readonly workspace?: ReadonlyArray<unknown>
    readonly settled?: ReadonlyArray<unknown>
    readonly name?: ReadonlyArray<unknown>
}

/** What the database double answers: rows per statement. */
type DatabaseStubs = {
    readonly query: ReadonlyArray<readonly [string, unknown]>
}

/** The rows the database double answers for each statement, overridable per spec. */
const stubsOf = (answers: Answers = {}): DatabaseStubs => ({
    query: [
        [LOCK_CHAIN_THREAD, answers.thread ?? [{ id: "thread-1", lead_id: "lead-1" }]],
        [LIST_CHAIN_STEPS, answers.history ?? []],
        [INSERT_CHAIN_STEP, answers.inserted ?? [{ id: "step-9" }]],
        [FIND_CHAIN_STEP, answers.stored ?? [rowOf({ id: "step-9", seq: 1 })]],
        [FIND_ACTIVE_MEMBER_IDS, answers.active ?? [{ id: "owner-1" }]],
        [FIND_WORKSPACE_OWNER, answers.workspace ?? [{ id: "boss-1" }]],
        [SETTLE_APPROVAL_STEP, answers.settled ?? [{ thread_id: "thread-1", action: "Approve 8%", lead_id: "lead-1" }]],
        [SETTLE_TARGETED_STEPS, []],
        [LINK_APPROVAL_STEP, []],
        [ABANDON_CHAIN_STEP, []],
        [FIND_ACTOR_NAME, answers.name ?? [{ name: "Mr Minh" }]],
    ],
})

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
            const em = mockEntityManager(stubsOf())
            const { service, events } = await build(em)

            const recorded = await service.record(stepOf())

            expect(recorded).toMatchObject({ verdict: "continue", stopReason: null, ownerTag: null })
            expect(recorded.step).toMatchObject({ id: "step-9", action: "Take the booking" })
            expect(em.query).toHaveBeenCalledWith(INSERT_CHAIN_STEP, [
                "ws-1",
                "thread-1",
                "agent",
                "agent-1",
                "self",
                "Take the booking",
                "",
                null,
                null,
                null,
                "done",
            ])
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
            const { service, events } = await build(
                mockEntityManager(stubsOf({ stored: [rowOf({ detail: "2 nights villa" })] })),
            )

            await service.record(stepOf({ detail: "2 nights villa" }))

            expect(events.record).toHaveBeenCalledWith(
                expect.objectContaining({ evidence: "2 nights villa" }),
                expect.anything(),
            )
        })

        it("joins the transaction of the caller when it hands one", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)

            await service.record(stepOf(), em)

            expect(em.transaction).not.toHaveBeenCalled()
            expect(em.query).toHaveBeenCalledWith(INSERT_CHAIN_STEP, expect.anything())
        })
    })
}

const registerStepKinds = () => {
    describe("record by step kind", () => {
        it("makes an approval step wait on its request", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)

            await service.record(
                stepOf({
                    kind: "ask_approval",
                    rule: "Discount: ask first 3-15%",
                    target: { kind: "group", id: "role:manager" },
                    approvalRequestId: "req-1",
                }),
            )

            expect(em.query).toHaveBeenCalledWith(INSERT_CHAIN_STEP, [
                "ws-1",
                "thread-1",
                "agent",
                "agent-1",
                "ask_approval",
                "Take the booking",
                "",
                "Discount: ask first 3-15%",
                JSON.stringify({ kind: "group", id: "role:manager" }),
                "req-1",
                "waiting",
            ])
        })

        it("makes a hand-off to an agent wait until that agent answers", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)

            await service.record(stepOf({ kind: "hand_off", target: { kind: "agent", id: "agent-2" } }))

            expect(em.query).toHaveBeenCalledWith(INSERT_CHAIN_STEP, expect.arrayContaining(["hand_off", "waiting"]))
        })

        it("ends a hand-off to a group at once, since no one person answers it", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)

            await service.record(stepOf({ kind: "hand_off", target: { kind: "group", id: "role:staff" } }))

            expect(em.query).toHaveBeenCalledWith(INSERT_CHAIN_STEP, expect.arrayContaining(["hand_off", "done"]))
        })

        it("ends a hand-off that tags nobody at once", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)

            await service.record(stepOf({ kind: "assign" }))

            expect(em.query).toHaveBeenCalledWith(INSERT_CHAIN_STEP, expect.arrayContaining(["assign", "done"]))
        })
    })
}

const registerRefusals = () => {
    describe("record refusals", () => {
        it("refuses a thread that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager(stubsOf({ thread: [] })))

            await expect(service.record(stepOf())).rejects.toMatchObject({ code: WorkChainsErrorCode.ThreadNotFound })
        })

        it("refuses a step the insert did not answer", async () => {
            const { service } = await build(mockEntityManager(stubsOf({ inserted: [] })))

            await expect(service.record(stepOf())).rejects.toMatchObject({ code: WorkChainsErrorCode.NotStored })
        })

        it("refuses a step that cannot be read back", async () => {
            const { service } = await build(mockEntityManager(stubsOf({ stored: [] })))

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
            const em = mockEntityManager(stubsOf({ history: twelveSteps }))
            const { service, events } = await build(em)

            const recorded = await service.record(stepOf())

            expect(recorded).toMatchObject({
                verdict: "stopped",
                stopReason: "limit",
                ownerTag: { kind: "member", id: "owner-1" },
            })
            expect(em.query).toHaveBeenCalledWith(INSERT_CHAIN_STEP, [
                "ws-1",
                "thread-1",
                "agent",
                "agent-1",
                "hand_off",
                "Take the booking",
                'chain.stopped.limit|{"max":12}',
                null,
                JSON.stringify({ kind: "member", id: "owner-1" }),
                null,
                "stopped",
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
            const { service } = await build(mockEntityManager(stubsOf({ history })))

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
            const stubs = stubsOf({ history: twelveSteps, active: [{ id: "fallback-1" }] })
            const { service } = await build(mockEntityManager(stubs))

            await expect(service.record(stepOf())).resolves.toMatchObject({
                ownerTag: { kind: "member", id: "fallback-1" },
            })
        })

        it("tags the workspace owner when neither the owner nor the fallback is active", async () => {
            const { service } = await build(mockEntityManager(stubsOf({ history: twelveSteps, active: [] })))

            await expect(service.record(stepOf())).resolves.toMatchObject({
                ownerTag: { kind: "member", id: "boss-1" },
            })
        })

        it("tags the fallback when the workspace has no owner row at all", async () => {
            const stubs = stubsOf({ history: twelveSteps, active: [], workspace: [] })
            const { service } = await build(mockEntityManager(stubs))

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
                    started_at: "2026-10-22T09:41:00+07:00",
                    finished_at: "2026-10-22T09:45:00+07:00",
                }),
            ]
            const { service } = await build(mockEntityManager(stubsOf({ history })))

            const view = await service.view("ws-1", "thread-1")

            expect(view.steps.map((step) => step.id)).toEqual(["s1", "s2"])
            expect(view.summary).toEqual({ steps: 2, humanDecisions: 1, minutes: 4, state: "complete" })
        })
    })
}

const registerApprovalLinks = () => {
    describe("linkApproval and abandon", () => {
        it("ties the approval step to its request", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)

            await service.linkApproval("ws-1", "step-1", "req-1")

            expect(em.query).toHaveBeenCalledWith(LINK_APPROVAL_STEP, ["ws-1", "step-1", "req-1"])
        })

        it("joins the transaction of the caller when it hands one", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)
            const other = mockEntityManager(stubsOf())

            await service.linkApproval("ws-1", "step-1", "req-1", other)

            expect(other.query).toHaveBeenCalledWith(LINK_APPROVAL_STEP, ["ws-1", "step-1", "req-1"])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("ends a waiting step whose request could not be opened", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)

            await service.abandon("ws-1", "step-1")

            expect(em.query).toHaveBeenCalledWith(ABANDON_CHAIN_STEP, ["ws-1", "step-1"])
        })
    })
}

const registerSettleFor = () => {
    describe("settleFor", () => {
        it("ends the hand-offs that waited on the one who answered", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)

            await service.settleFor("ws-1", "thread-1", { kind: "member", id: "van" })

            expect(em.query).toHaveBeenCalledWith(SETTLE_TARGETED_STEPS, ["ws-1", "thread-1", "member", "van"])
        })

        it("joins the transaction of the caller when it hands one", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)
            const other = mockEntityManager(stubsOf())

            await service.settleFor("ws-1", "thread-1", { kind: "agent", id: "agent-2" }, other)

            expect(other.query).toHaveBeenCalledWith(SETTLE_TARGETED_STEPS, ["ws-1", "thread-1", "agent", "agent-2"])
            expect(em.query).not.toHaveBeenCalled()
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
            const em = mockEntityManager(stubsOf())
            const { service, events } = await build(em)

            await service.settleApproval(approval("approved", "minh"))

            expect(em.query).toHaveBeenCalledWith(SETTLE_APPROVAL_STEP, ["ws-1", "req-1", "done", "minh"])
            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    kind: "work_chain.approval",
                    actor: "Mr Minh",
                    summary: 'chain.approval.approved|{"name":"Mr Minh","action":"Approve 8%"}',
                    leadId: "lead-1",
                },
                em,
            )
        })

        it("settles an expired request with nobody as the decider", async () => {
            const em = mockEntityManager(stubsOf())
            const { service, events } = await build(em)

            await service.settleApproval(approval("expired", null, "en"))

            expect(em.query).toHaveBeenCalledWith(SETTLE_APPROVAL_STEP, ["ws-1", "req-1", "expired", null])
            expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ actor: "" }), em)
        })

        it("names the decider as empty when the member is gone", async () => {
            const { service, events } = await build(mockEntityManager(stubsOf({ name: [] })))

            await service.settleApproval(approval("rejected", "gone"))

            expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ actor: "" }), expect.anything())
        })

        it("writes nothing when no waiting step belongs to the request", async () => {
            const { service, events } = await build(mockEntityManager(stubsOf({ settled: [] })))

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
