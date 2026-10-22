import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import type { ThreadMessageRow } from "./persistence/thread-messages.rows"
import { FIND_MESSAGE } from "./persistence/thread-messages.sql"
import { toMessage } from "./thread.mapper"
import { ThreadApprovalOutcomesService } from "./thread-approval-outcomes.service"
import { ThreadApprovalsService } from "./thread-approvals.service"
import type { ApprovalCard, ThreadApprovalDecisionResult, CardApprover } from "./thread-messages.contracts"
import { APPROVAL_GATE } from "./thread-messages.decorators"
import type { ThreadApprovalGate } from "./thread-messages.port"

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

const DECIDED: ApprovalCard = {
    ...PENDING,
    outcome: "approved",
    decidedBy: "nam",
    decidedByName: "Nam",
    decidedAt: "2026-10-22T09:42:00.000Z",
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
    /** The message as the first read finds it. */
    readonly found?: ReadonlyArray<ThreadMessageRow>
    /** The message as the lock finds it, after the gate answered. */
    readonly locked?: ThreadMessageRow
    /** What the gate answers. */
    readonly decision?: ThreadApprovalDecisionResult
}

const build = async (em: MockEntityManager, answers: Answers = {}) => {
    fakeTransaction(em)
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(MEMBER) })
    const gate = mock<ThreadApprovalGate>({
        open: jest.fn(),
        decide: jest.fn().mockResolvedValue(answers.decision ?? { status: "approved" }),
    })
    const directory = mock<MentionDirectoryService>({
        memberIdOf: jest.fn().mockImplementation((...args: Array<unknown>) => Promise.resolve(args[2])),
    })
    const outcomes = mock<ThreadApprovalOutcomesService>({
        lock: jest.fn().mockResolvedValue(answers.locked ?? rowOf(PENDING)),
        keep: jest.fn((...[, , card]: [unknown, unknown, ApprovalCard]) => Promise.resolve(toMessage(rowOf(card)))),
        settle: jest.fn().mockResolvedValue(toMessage(rowOf(DECIDED))),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadApprovalsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: APPROVAL_GATE, useValue: gate },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MentionDirectoryService, useValue: directory },
            { provide: ThreadApprovalOutcomesService, useValue: outcomes },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadApprovalsService), members, gate, outcomes }
}

const found = (rows: ReadonlyArray<ThreadMessageRow> = [rowOf(PENDING)]) => ({ query: [[FIND_MESSAGE, rows]] as const })

const decision = (verdict: "approve" | "reject" = "approve", userId = "minh") => ({
    workspaceId: "ws-1",
    messageId: "msg-1",
    userId,
    verdict,
    locale: "vi" as const,
})

const registerRefusals = () => {
    describe("decide refusals", () => {
        it("refuses a message that is not in the workspace", async () => {
            const { service } = await build(mockEntityManager(found([])))

            await expect(service.decide(decision())).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MessageNotFound,
            })
        })

        it("refuses a message with no card", async () => {
            const { service } = await build(mockEntityManager(found([rowOf(null)])))

            await expect(service.decide(decision())).rejects.toMatchObject({ code: ThreadMessagesErrorCode.NoApproval })
        })

        it("refuses a member who is not among the people tagged, without asking the gate", async () => {
            const { service, gate } = await build(mockEntityManager(found()))

            await expect(service.decide(decision("approve", "van"))).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.NotApprover,
            })
            expect(gate.decide).not.toHaveBeenCalled()
        })

        it("tells the late clicker who already decided and when", async () => {
            const { service, gate } = await build(mockEntityManager(found([rowOf(DECIDED)])))

            await expect(service.decide(decision())).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.AlreadyDecided,
                params: { name: "Nam", at: "2026-10-22T09:42:00.000Z" },
            })
            expect(gate.decide).not.toHaveBeenCalled()
        })

        it("names nobody when a decided card has no name or instant", async () => {
            const { service } = await build(mockEntityManager(found([rowOf({ ...PENDING, outcome: "rejected" })])))

            await expect(service.decide(decision())).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.AlreadyDecided,
                params: { name: "", at: "" },
            })
        })

        it("refuses a card that expired", async () => {
            const { service } = await build(mockEntityManager(found([rowOf({ ...PENDING, outcome: "expired" })])))

            await expect(service.decide(decision())).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.ApprovalClosed,
            })
        })
    })
}

const registerDecisions = () => {
    describe("decide", () => {
        it("asks the gate as the member and settles the card with the member's vote and the gate's answer", async () => {
            const { service, gate, members, outcomes } = await build(mockEntityManager(found()))

            const message = await service.decide(decision())

            expect(members.require).toHaveBeenCalledWith("minh", "ws-1")
            expect(gate.decide).toHaveBeenCalledWith({ requestId: "req-1", memberId: "minh", verdict: "approve" })
            expect(outcomes.lock).toHaveBeenCalledWith(expect.anything(), "ws-1", "msg-1")
            expect(outcomes.settle).toHaveBeenCalledWith(
                expect.anything(),
                rowOf(PENDING),
                { ...PENDING, approvers: [{ ...MINH_LINE, status: "approved" }, NAM_LINE] },
                { outcome: "approved", decidedBy: "minh" },
                "vi",
            )
            expect(message.approval).toMatchObject({ outcome: "approved" })
        })

        it("settles a rejection the gate answered as rejected", async () => {
            const { service, outcomes } = await build(mockEntityManager(found()), { decision: { status: "rejected" } })

            await service.decide(decision("reject"))

            expect(outcomes.settle).toHaveBeenCalledWith(
                expect.anything(),
                rowOf(PENDING),
                { ...PENDING, approvers: [{ ...MINH_LINE, status: "rejected" }, NAM_LINE] },
                { outcome: "rejected", decidedBy: "minh" },
                "vi",
            )
        })

        it("only records the vote while the policy still waits for more people", async () => {
            const { service, outcomes } = await build(mockEntityManager(found()), { decision: { status: "pending" } })

            const message = await service.decide(decision("approve", "nam"))

            const voted: ApprovalCard = { ...PENDING, approvers: [MINH_LINE, { ...NAM_LINE, status: "approved" }] }
            expect(outcomes.keep).toHaveBeenCalledWith(expect.anything(), rowOf(PENDING), voted)
            expect(outcomes.settle).not.toHaveBeenCalled()
            expect(message.approval?.outcome).toBe("pending")
        })

        it("returns the card as settled when approval.resolved settled it while the gate was answering", async () => {
            const { service, outcomes } = await build(mockEntityManager(found()), { locked: rowOf(DECIDED) })

            const message = await service.decide(decision())

            expect(message.approval).toMatchObject({ outcome: "approved", decidedByName: "Nam" })
            expect(outcomes.keep).not.toHaveBeenCalled()
            expect(outcomes.settle).not.toHaveBeenCalled()
        })
    })
}

describe("ThreadApprovalsService", () => {
    registerRefusals()
    registerDecisions()
})
