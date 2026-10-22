import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkChainsService } from "@modules/domain/work-chains"
import type { ChainStep, RecordedStep } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import { FIND_AGENT } from "./persistence/thread-messages.sql"
import { ThreadAgentPostsService } from "./thread-agent-posts.service"
import { ThreadMessagesService } from "./thread-messages.service"
import type { AgentPost, MentionView, OpenedApproval, ThreadMessage } from "./thread-messages.contracts"
import { AGENT_RULES, APPROVAL_GATE } from "./thread-messages.decorators"
import type { AgentRules, ApprovalGate } from "./thread-messages.port"

const MINH = "11111111-1111-4111-8111-111111111111"
const ACCOUNTING_AI = "33333333-3333-4333-8333-333333333333"

const MESSAGE: ThreadMessage = {
    id: "msg-1",
    threadId: "thread-1",
    authorKind: "agent",
    authorId: "agent-1",
    authorName: "AI Sales",
    authorRole: "sales",
    body: "Ms Thao booked 2 villa nights.",
    quoted: [],
    mentions: [],
    approval: null,
    createdAt: "2026-10-22T02:41:00.000Z",
}

const stepOf = (id: string): ChainStep => ({
    id,
    seq: 1,
    actor: { kind: "agent", id: "agent-1" },
    actorName: "AI Sales",
    actorRole: "sales",
    kind: "ask_approval",
    action: "Discount 12%",
    detail: "limit text",
    rule: null,
    target: null,
    approvalRequestId: null,
    status: "waiting",
    decidedBy: null,
    startedAt: "2026-10-22T02:41:00.000Z",
    finishedAt: null,
})

const continued = (id = "step-1"): RecordedStep => ({
    step: stepOf(id),
    verdict: "continue",
    stopReason: null,
    ownerTag: null,
})

const stopped = (reason: "limit" | "loop"): RecordedStep => ({
    step: stepOf("step-stop"),
    verdict: "stopped",
    stopReason: reason,
    ownerTag: { kind: "member", id: MINH },
})

const OPENED: OpenedApproval = {
    requestId: "req-1",
    approvers: [{ memberId: MINH, name: "Mr Minh", role: "manager", roomId: "sales" }],
    excluded: [{ memberId: "ha", reason: "limit" }],
    policy: "any",
    expiresAt: "2026-10-22T10:11:00.000Z",
}

const agentPost = (overrides: Partial<AgentPost> = {}): AgentPost => ({
    workspaceId: "ws-1",
    threadId: "thread-1",
    agentId: "agent-1",
    body: "Ms Thao booked 2 villa nights.",
    mentions: [],
    quoted: [],
    stepTitle: null,
    approval: null,
    locale: "vi",
    ...overrides,
})

const ASK = { action: "Discount 12%", amount: 12, unit: "percent", rule: "Customer discount" } as const

interface Doubles {
    readonly canTag?: boolean
    readonly recorded?: ReadonlyArray<RecordedStep>
    readonly open?: () => Promise<OpenedApproval>
    readonly views?: ReadonlyArray<MentionView>
}

const build = async (em: MockEntityManager, doubles: Doubles = {}) => {
    fakeTransaction(em)
    const directory = mock<MentionDirectoryService>({
        resolve: jest.fn().mockResolvedValue(doubles.views ?? []),
        nameOfMember: jest.fn().mockResolvedValue("Mr Minh"),
        namesOf: jest.fn().mockResolvedValue({ ha: "Ms Ha" }),
    })
    const threads = mock<WorkThreadsService>({
        lock: jest.fn().mockResolvedValue(undefined),
        setStatus: jest.fn().mockResolvedValue(undefined),
    })
    const recorded = [...(doubles.recorded ?? [])]
    const chains = mock<WorkChainsService>({
        record: jest.fn(() => Promise.resolve(recorded.shift() ?? continued())),
        settleFor: jest.fn().mockResolvedValue(undefined),
        linkApproval: jest.fn().mockResolvedValue(undefined),
        abandon: jest.fn().mockResolvedValue(undefined),
        ownerTagOf: jest.fn().mockResolvedValue({ kind: "member", id: MINH }),
    })
    const messages = mock<ThreadMessagesService>({
        append: jest.fn().mockResolvedValue(MESSAGE),
        proveAgents: jest.fn().mockResolvedValue(undefined),
    })
    const rules = mock<AgentRules>({
        canAssign: jest.fn(),
        canTag: jest.fn().mockResolvedValue(doubles.canTag ?? true),
    })
    const gate = mock<ApprovalGate>({
        open: jest.fn(doubles.open ?? (() => Promise.resolve(OPENED))),
        decide: jest.fn(),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadAgentPostsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AGENT_RULES, useValue: rules },
            { provide: APPROVAL_GATE, useValue: gate },
            { provide: MentionDirectoryService, useValue: directory },
            { provide: WorkThreadsService, useValue: threads },
            { provide: WorkChainsService, useValue: chains },
            { provide: ThreadMessagesService, useValue: messages },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadAgentPostsService), directory, threads, chains, messages, rules, gate }
}

/** What the database double answers: rows per statement. */
type DatabaseStubs = {
    readonly query: ReadonlyArray<readonly [string, unknown]>
}

const agentStubs = (found: ReadonlyArray<unknown> = [{ id: "agent-1", name: "AI Sales" }]): DatabaseStubs => ({
    query: [[FIND_AGENT, found]],
})

const registerPlainPosts = () => {
    describe("postAsAgent without an approval", () => {
        it("refuses an agent that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager(agentStubs([])))

            await expect(service.postAsAgent(agentPost())).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.AgentNotFound,
            })
        })

        it("writes a plain agent line and leaves the thread open", async () => {
            const { service, chains, threads, messages } = await build(mockEntityManager(agentStubs()))

            const posted = await service.postAsAgent(agentPost())

            expect(posted).toEqual({ message: MESSAGE, stopped: null })
            expect(chains.settleFor).toHaveBeenCalledWith(
                "ws-1",
                "thread-1",
                { kind: "agent", id: "agent-1" },
                expect.anything(),
            )
            expect(chains.record).not.toHaveBeenCalled()
            expect(messages.append).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ body: "Ms Thao booked 2 villa nights.", card: null }),
            )
            expect(threads.setStatus).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", "open")
        })

        it("asks the agents capability before the agent tags another agent", async () => {
            const { service, messages, rules } = await build(mockEntityManager(agentStubs()))
            messages.proveAgents.mockImplementation((...args) => args[1](ACCOUNTING_AI).then(() => undefined))

            await service.postAsAgent(agentPost())

            expect(rules.canTag).toHaveBeenCalledWith("agent-1", ACCOUNTING_AI)
            expect(messages.proveAgents).toHaveBeenCalledWith(
                [],
                expect.any(Function),
                ThreadMessagesErrorCode.TagNotAllowed,
            )
        })
    })
}

const registerTags = () => {
    describe("postAsAgent tags", () => {
        it("hands work to another agent and tags a person and a group", async () => {
            const views: ReadonlyArray<MentionView> = [
                { kind: "agent", id: ACCOUNTING_AI, name: "Accounting AI" },
                { kind: "member", id: MINH, name: "Mr Minh" },
                { kind: "group", id: "role:manager", name: "Managers" },
            ]
            const { service, chains } = await build(mockEntityManager(agentStubs()), { views })

            await service.postAsAgent(
                agentPost({
                    stepTitle: "Hand off",
                    mentions: [
                        { kind: "agent", id: ACCOUNTING_AI },
                        { kind: "member", id: MINH },
                        { kind: "group", id: "role:manager" },
                    ],
                }),
            )

            expect(chains.record).toHaveBeenCalledTimes(3)
            expect(chains.record).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    kind: "hand_off",
                    action: "Hand off",
                    actor: { kind: "agent", id: "agent-1" },
                    target: { kind: "agent", id: ACCOUNTING_AI },
                }),
                expect.anything(),
            )
        })

        it("stops at the first hand-off the chain limits stop, tags the owner and records no more", async () => {
            const views: ReadonlyArray<MentionView> = [
                { kind: "member", id: MINH, name: "Mr Minh" },
                { kind: "agent", id: ACCOUNTING_AI, name: "Accounting AI" },
                { kind: "group", id: "role:staff", name: "Staff" },
            ]
            const { service, chains, messages, threads } = await build(mockEntityManager(agentStubs()), {
                views,
                recorded: [continued("a"), stopped("loop")],
            })

            const posted = await service.postAsAgent(agentPost())

            expect(posted.stopped).toBe("loop")
            expect(chains.record).toHaveBeenCalledTimes(2)
            expect(messages.append).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    body: "Ms Thao booked 2 villa nights.\nlimit text",
                    mentions: [{ kind: "member", id: MINH, name: "Mr Minh" }],
                }),
            )
            expect(threads.setStatus).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", "stopped")
        })
    })
}

const registerApprovalAsks = () => {
    describe("postAsAgent with an approval ask", () => {
        it("opens an approval, ties its step to the request and carries the card in the message", async () => {
            const views: ReadonlyArray<MentionView> = [
                { kind: "group", id: "role:manager", name: "Managers" },
                { kind: "member", id: MINH, name: "Mr Minh" },
            ]
            const em = mockEntityManager(agentStubs())
            const { service, gate, chains, directory, messages, threads } = await build(em, {
                views,
                recorded: [continued("step-ask")],
            })

            await service.postAsAgent(
                agentPost({
                    mentions: [
                        { kind: "group", id: "role:manager" },
                        { kind: "member", id: MINH },
                    ],
                    approval: ASK,
                }),
            )

            expect(chains.record).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    kind: "ask_approval",
                    action: "Discount 12%",
                    rule: "Customer discount",
                    target: { kind: "group", id: "role:manager" },
                }),
            )
            expect(gate.open).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                chainStepId: "step-ask",
                action: "Discount 12%",
                amount: 12,
                unit: "percent",
                requestedByAgentId: "agent-1",
            })
            expect(directory.namesOf).toHaveBeenCalledWith(em, "ws-1", ["ha"])
            expect(chains.linkApproval).toHaveBeenCalledWith("ws-1", "step-ask", "req-1", expect.anything())
            expect(chains.record).toHaveBeenCalledTimes(2)
            expect(messages.append).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    card: expect.objectContaining({
                        requestId: "req-1",
                        policy: "any",
                        outcome: "pending",
                        approvers: [expect.objectContaining({ memberId: MINH, status: "waiting" })],
                        excluded: [{ memberId: "ha", name: "Ms Ha", reason: "limit" }],
                        owner: { kind: "member", id: MINH, name: "Mr Minh" },
                    }),
                }),
            )
            expect(threads.setStatus).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", "waiting")
        })

        it("asks with no group tagged and no hand-off steps for the ask itself", async () => {
            const { service, chains } = await build(mockEntityManager(agentStubs()), {
                recorded: [continued("step-ask")],
            })

            await service.postAsAgent(agentPost({ approval: { ...ASK, amount: null, unit: null } }))

            expect(chains.record).toHaveBeenCalledTimes(1)
            expect(chains.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "ask_approval", target: null }))
        })
    })
}

const registerApprovalFailures = () => {
    describe("postAsAgent when an approval cannot go ahead", () => {
        it("ends the waiting step and lets the failure travel when the request cannot be opened", async () => {
            const failure = new Error("gate down")
            const { service, chains } = await build(mockEntityManager(agentStubs()), {
                recorded: [continued("step-ask")],
                open: () => Promise.reject(failure),
            })

            await expect(service.postAsAgent(agentPost({ approval: ASK }))).rejects.toBe(failure)
            expect(chains.abandon).toHaveBeenCalledWith("ws-1", "step-ask")
        })

        it("sends an ask the chain limits stopped back to the owner without opening a request", async () => {
            const { service, gate, messages, threads } = await build(mockEntityManager(agentStubs()), {
                views: [{ kind: "group", id: "role:manager", name: "Managers" }],
                recorded: [stopped("limit")],
            })

            const posted = await service.postAsAgent(
                agentPost({ mentions: [{ kind: "group", id: "role:manager" }], approval: ASK }),
            )

            expect(posted.stopped).toBe("limit")
            expect(gate.open).not.toHaveBeenCalled()
            expect(messages.append).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    body: "Ms Thao booked 2 villa nights.\nlimit text",
                    mentions: [{ kind: "member", id: MINH, name: "Mr Minh" }],
                    card: null,
                }),
            )
            expect(threads.setStatus).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", "stopped")
        })
    })
}

describe("ThreadAgentPostsService", () => {
    registerPlainPosts()
    registerTags()
    registerApprovalAsks()
    registerApprovalFailures()
})
