import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkChainsService } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import type { ApprovalMessageRow, ThreadMessageRow } from "./persistence/thread-messages.rows"
import {
    FIND_MESSAGE,
    FIND_MESSAGE_BY_APPROVAL,
    LOCK_MESSAGE,
    UPDATE_MESSAGE_APPROVAL,
} from "./persistence/thread-messages.sql"
import { ThreadApprovalsService } from "./thread-approvals.service"
import { ThreadMessagesService } from "./thread-messages.service"
import type { ApprovalCard, ApprovalDecisionResult, CardApprover } from "./thread-messages.contracts"
import { APPROVAL_GATE } from "./thread-messages.decorators"
import type { ApprovalGate } from "./thread-messages.port"

const MEMBER: WorkspaceMember = {
    userId: "minh",
    workspaceId: "ws-1",
    role: "manager",
    staffId: null,
    displayName: "Mr Minh",
    status: "active",
}

const MINH_LINE: CardApprover = {
    memberId: "minh",
    name: "Mr Minh",
    role: "manager",
    roomId: "sales",
    status: "waiting",
}
const NAM_LINE: CardApprover = { memberId: "nam", name: "Nam", role: "owner", roomId: null, status: "waiting" }

const PENDING: ApprovalCard = {
    requestId: "req-1",
    action: "Discount 12%",
    amount: 12,
    unit: "percent",
    rule: "Customer discount",
    policy: "any",
    expiresAt: "2026-10-22T10:11:00.000Z",
    approvers: [MINH_LINE, NAM_LINE],
    excluded: [{ memberId: "ha", name: "Ms Ha", reason: "limit" }],
    outcome: "pending",
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    owner: { kind: "member", id: "minh", name: "Mr Minh" },
}

const rowOf = (approval: ApprovalCard | null): ThreadMessageRow => ({
    id: "msg-1",
    thread_id: "thread-1",
    workspace_id: "ws-1",
    author_kind: "agent",
    author_id: "agent-1",
    author_name: "AI Sales",
    author_role: "sales",
    body: "Customer asks 12% off.",
    quoted: [],
    mentions: [],
    approval,
    created_at: "2026-10-22T09:41:00+07:00",
})

interface Answers {
    readonly found?: ReadonlyArray<ThreadMessageRow>
    readonly locked?: ReadonlyArray<ThreadMessageRow>
    readonly byApproval?: ReadonlyArray<ApprovalMessageRow>
}

/** What the database double answers: rows per statement. */
type DatabaseStubs = {
    readonly query: ReadonlyArray<readonly [string, unknown]>
}

/** The rows the database double answers for each statement, overridable per spec. */
const stubsOf = (answers: Answers = {}): DatabaseStubs => ({
    query: [
        [FIND_MESSAGE, answers.found ?? [rowOf(PENDING)]],
        [LOCK_MESSAGE, answers.locked ?? [rowOf(PENDING)]],
        [FIND_MESSAGE_BY_APPROVAL, answers.byApproval ?? [{ id: "msg-1", workspace_id: "ws-1" }]],
        [UPDATE_MESSAGE_APPROVAL, []],
    ],
})

const build = async (
    em: MockEntityManager,
    decision: ApprovalDecisionResult = { outcome: "approved", decidedBy: "minh" },
) => {
    fakeTransaction(em)
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(MEMBER) })
    const gate = mock<ApprovalGate>({ open: jest.fn(), decide: jest.fn().mockResolvedValue(decision) })
    const directory = mock<MentionDirectoryService>({
        nameOfMember: jest.fn().mockResolvedValue("Mr Minh"),
        memberIdOf: jest.fn().mockImplementation((...args: Array<unknown>) => Promise.resolve(args[2])),
    })
    const threads = mock<WorkThreadsService>({ setStatus: jest.fn().mockResolvedValue(undefined) })
    const chains = mock<WorkChainsService>({
        settleApproval: jest.fn().mockResolvedValue(undefined),
        ownerTagOf: jest.fn().mockResolvedValue({ kind: "member", id: "minh" }),
        record: jest.fn().mockResolvedValue(undefined),
    })
    const messages = mock<ThreadMessagesService>({ append: jest.fn().mockResolvedValue(undefined) })
    const catalog = mock<MessageCatalog>({
        get: jest.fn(
            (key: string, params: Readonly<Record<string, string | number>>) => `${key}|${JSON.stringify(params)}`,
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadApprovalsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-10-22T09:42:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: APPROVAL_GATE, useValue: gate },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MentionDirectoryService, useValue: directory },
            { provide: WorkThreadsService, useValue: threads },
            { provide: WorkChainsService, useValue: chains },
            { provide: ThreadMessagesService, useValue: messages },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadApprovalsService), members, gate, directory, threads, chains, messages }
}

const decision = (verdict: "approve" | "reject" = "approve", userId = "minh") => ({
    workspaceId: "ws-1",
    messageId: "msg-1",
    userId,
    verdict,
    locale: "vi" as const,
})

/** The card the way the service stores it once someone decided: the pending card with the changes spread over it. */
const stored = (changes: Partial<ApprovalCard>, approvers: ApprovalCard["approvers"] = PENDING.approvers): string =>
    JSON.stringify({ ...PENDING, approvers, ...changes })

const approvedBy = (name: string, id: string, approvers: ApprovalCard["approvers"]): Partial<ApprovalCard> => ({
    approvers,
    outcome: "approved",
    decidedBy: id,
    decidedByName: name,
    decidedAt: "2026-10-22T09:42:00.000Z",
})

const registerRefusals = () => {
    describe("decide refusals", () => {
        it("refuses a message that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager(stubsOf({ found: [] })))

            await expect(service.decide(decision())).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MessageNotFound,
            })
        })

        it("refuses a message with no card", async () => {
            const { service } = await build(mockEntityManager(stubsOf({ found: [rowOf(null)] })))

            await expect(service.decide(decision())).rejects.toMatchObject({ code: ThreadMessagesErrorCode.NoApproval })
        })

        it("refuses a member who is not among the people tagged, without asking the gate", async () => {
            const { service, gate } = await build(mockEntityManager(stubsOf()))

            await expect(service.decide(decision("approve", "van"))).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.NotApprover,
            })
            expect(gate.decide).not.toHaveBeenCalled()
        })

        it("refuses a message that vanished before the card was written", async () => {
            const { service } = await build(mockEntityManager(stubsOf({ locked: [] })))

            await expect(service.decide(decision())).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MessageNotFound,
            })
        })
    })
}

const registerClosedCards = () => {
    describe("decide on a card that is already closed", () => {
        it("tells the late clicker who already decided and when", async () => {
            const decided = { ...PENDING, ...approvedBy("Nam", "nam", PENDING.approvers) }
            const { service, gate } = await build(mockEntityManager(stubsOf({ found: [rowOf(decided)] })))

            await expect(service.decide(decision())).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.AlreadyDecided,
                params: { name: "Nam", at: "2026-10-22T09:42:00.000Z" },
            })
            expect(gate.decide).not.toHaveBeenCalled()
        })

        it("names nobody when a decided card has no name or instant", async () => {
            const decided: ApprovalCard = { ...PENDING, outcome: "rejected" }
            const { service } = await build(mockEntityManager(stubsOf({ found: [rowOf(decided)] })))

            await expect(service.decide(decision())).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.AlreadyDecided,
                params: { name: "", at: "" },
            })
        })

        it("refuses a card that expired", async () => {
            const expired: ApprovalCard = { ...PENDING, outcome: "expired" }
            const { service } = await build(mockEntityManager(stubsOf({ found: [rowOf(expired)] })))

            await expect(service.decide(decision())).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.ApprovalClosed,
            })
        })
    })
}

const registerApprove = () => {
    describe("decide approves", () => {
        it("settles an approved card, the step and the thread and returns the message with the decided card", async () => {
            const em = mockEntityManager(stubsOf())
            const { service, gate, chains, members, messages, threads } = await build(em)

            const message = await service.decide(decision())

            expect(members.require).toHaveBeenCalledWith("minh", "ws-1")
            expect(gate.decide).toHaveBeenCalledWith({ requestId: "req-1", memberId: "minh", verdict: "approve" })
            const approvers: ApprovalCard["approvers"] = [{ ...MINH_LINE, status: "approved" }, NAM_LINE]
            expect(em.query).toHaveBeenCalledWith(UPDATE_MESSAGE_APPROVAL, [
                "ws-1",
                "msg-1",
                stored(approvedBy("Mr Minh", "minh", approvers)),
            ])
            expect(chains.settleApproval).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    approvalRequestId: "req-1",
                    outcome: "approved",
                    decidedBy: "minh",
                    locale: "vi",
                },
                expect.anything(),
            )
            expect(threads.setStatus).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", "open")
            expect(messages.append).not.toHaveBeenCalled()
            expect(message.approval).toMatchObject({ outcome: "approved", decidedByName: "Mr Minh" })
        })

        it("credits the member who clicked when the gate names no decider", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em, { outcome: "approved", decidedBy: null })

            const message = await service.decide(decision())

            expect(message.approval).toMatchObject({ decidedBy: "minh" })
        })
    })
}

const registerRejectAndWait = () => {
    describe("decide rejects or waits", () => {
        it("sends a rejected card back to the owner of the agent: the agent says so, tags them and the chain records it", async () => {
            const em = mockEntityManager(stubsOf())
            const { service, chains, messages, threads } = await build(em, { outcome: "rejected", decidedBy: "minh" })

            await service.decide(decision("reject"))

            expect(threads.setStatus).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", "stopped")
            expect(chains.ownerTagOf).toHaveBeenCalledWith("ws-1", "agent-1", expect.anything())
            expect(messages.append).toHaveBeenCalledWith(expect.anything(), {
                workspaceId: "ws-1",
                threadId: "thread-1",
                author: { kind: "agent", id: "agent-1" },
                body: 'thread.owner.rejected|{"agent":"AI Sales","action":"Discount 12%"}',
                quoted: [],
                mentions: [{ kind: "member", id: "minh", name: "Mr Minh" }],
                card: null,
            })
            expect(chains.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: "hand_off",
                    actor: { kind: "agent", id: "agent-1" },
                    target: { kind: "member", id: "minh" },
                    rule: "Customer discount",
                    action: 'thread.owner.step|{"action":"Discount 12%"}',
                }),
                expect.anything(),
            )
        })

        it("only records the vote while the policy still waits for more people", async () => {
            const em = mockEntityManager(stubsOf())
            const { service, chains, threads } = await build(em, { outcome: "pending", decidedBy: null })

            const message = await service.decide(decision("approve", "nam"))

            const approvers: ApprovalCard["approvers"] = [MINH_LINE, { ...NAM_LINE, status: "approved" }]
            expect(em.query).toHaveBeenCalledWith(UPDATE_MESSAGE_APPROVAL, ["ws-1", "msg-1", stored({}, approvers)])
            expect(chains.settleApproval).not.toHaveBeenCalled()
            expect(threads.setStatus).not.toHaveBeenCalled()
            expect(message.approval?.outcome).toBe("pending")
        })

        it("returns the message untouched when someone else settled the card while the gate was asked", async () => {
            const settled: ApprovalCard = { ...PENDING, ...approvedBy("Nam", "nam", PENDING.approvers) }
            const em = mockEntityManager(stubsOf({ locked: [rowOf(settled)] }))
            const { service, chains } = await build(em)

            const message = await service.decide(decision())

            expect(message.approval).toMatchObject({ outcome: "approved", decidedByName: "Nam" })
            expect(em.query).not.toHaveBeenCalledWith(UPDATE_MESSAGE_APPROVAL, expect.anything())
            expect(chains.settleApproval).not.toHaveBeenCalled()
        })
    })
}

const resolved = (outcome: "approved" | "rejected" | "expired", decidedBy: string | null) => ({
    requestId: "req-1",
    outcome,
    decidedBy,
})

const registerResolved = () => {
    describe("applyResolved", () => {
        it("ignores a request no thread card belongs to", async () => {
            const { service, chains } = await build(mockEntityManager(stubsOf({ byApproval: [] })))

            await expect(service.applyResolved(resolved("approved", "nam"), "vi")).resolves.toBe(false)
            expect(chains.settleApproval).not.toHaveBeenCalled()
        })

        it("settles the card of a request decided elsewhere", async () => {
            const em = mockEntityManager(stubsOf())
            const { service, chains } = await build(em)

            await expect(service.applyResolved(resolved("approved", "nam"), "vi")).resolves.toBe(true)

            expect(em.query).toHaveBeenCalledWith(UPDATE_MESSAGE_APPROVAL, [
                "ws-1",
                "msg-1",
                stored(approvedBy("Mr Minh", "nam", PENDING.approvers)),
            ])
            expect(chains.settleApproval).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    approvalRequestId: "req-1",
                    outcome: "approved",
                    decidedBy: "nam",
                    locale: "vi",
                },
                expect.anything(),
            )
        })

        it("sends an expired request back to the owner with nobody as the decider", async () => {
            const em = mockEntityManager(stubsOf())
            const { service, directory, messages, threads } = await build(em)

            await service.applyResolved(resolved("expired", null), "en")

            expect(em.query).toHaveBeenCalledWith(UPDATE_MESSAGE_APPROVAL, [
                "ws-1",
                "msg-1",
                stored({
                    outcome: "expired",
                    decidedBy: null,
                    decidedByName: null,
                    decidedAt: "2026-10-22T09:42:00.000Z",
                }),
            ])
            expect(directory.nameOfMember).toHaveBeenCalledTimes(1)
            expect(messages.append).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ body: 'thread.owner.expired|{"agent":"AI Sales","action":"Discount 12%"}' }),
            )
            expect(threads.setStatus).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", "stopped")
        })

        it("does nothing twice when the card was already settled", async () => {
            const settled: ApprovalCard = { ...PENDING, outcome: "approved" }
            const em = mockEntityManager(stubsOf({ locked: [rowOf(settled)] }))
            const { service, chains } = await build(em)

            await expect(service.applyResolved(resolved("approved", "nam"), "vi")).resolves.toBe(true)

            expect(em.query).not.toHaveBeenCalledWith(UPDATE_MESSAGE_APPROVAL, expect.anything())
            expect(chains.settleApproval).not.toHaveBeenCalled()
        })
    })
}

describe("ThreadApprovalsService", () => {
    registerRefusals()
    registerClosedCards()
    registerApprove()
    registerRejectAndWait()
    registerResolved()
})
