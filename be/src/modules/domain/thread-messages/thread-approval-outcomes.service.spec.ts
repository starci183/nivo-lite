import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkChainsService } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import type { ApprovalMessageRow, ThreadMessageRow } from "./persistence/thread-messages.rows"
import { FIND_MESSAGE_BY_APPROVAL, LOCK_MESSAGE, UPDATE_MESSAGE_APPROVAL } from "./persistence/thread-messages.sql"
import { ThreadApprovalOutcomesService } from "./thread-approval-outcomes.service"
import { ThreadMessagesService } from "./thread-messages.service"
import type { ApprovalCard, ApprovalResolved, CardApprover } from "./thread-messages.contracts"

const MINH_LINE: CardApprover = {
    memberId: "minh",
    name: "Anh Minh",
    role: "manager",
    roomId: "sales",
    status: "waiting",
}
const HA_LINE: CardApprover = { memberId: "ha", name: "Chi Ha", role: "manager", roomId: "sales", status: "waiting" }
const AT = "2026-10-22T09:42:00.000Z"

const PENDING: ApprovalCard = {
    requestId: "req-1",
    action: "Discount 8%",
    amount: 8,
    unit: "percent",
    rule: "Customer discount",
    policy: "any",
    expiresAt: "2026-10-22T10:11:00.000Z",
    approvers: [MINH_LINE, HA_LINE],
    excluded: [{ memberId: "lan", name: "Lan", reason: "no_grant" }],
    outcome: "pending",
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    owner: { kind: "member", id: "minh", name: "Anh Minh" },
}

const rowOf = (approval: ApprovalCard | null): ThreadMessageRow => ({
    id: "msg-1",
    thread_id: "thread-1",
    workspace_id: "ws-1",
    author_kind: "agent",
    author_id: "agent-sales",
    author_name: "AI Sales",
    author_role: "sales",
    body: "Need approval for 8% off.",
    quoted: [],
    mentions: [],
    approval,
    created_at: "2026-10-22T09:41:00+07:00",
})

interface Answers {
    readonly locked?: ReadonlyArray<ThreadMessageRow>
    readonly byApproval?: ReadonlyArray<ApprovalMessageRow>
}

/** The rows the database double answers for each statement, overridable per spec. */
const stubsOf = (answers: Answers = {}) => ({
    query: [
        [LOCK_MESSAGE, answers.locked ?? [rowOf(PENDING)]],
        [FIND_MESSAGE_BY_APPROVAL, answers.byApproval ?? [{ id: "msg-1", workspace_id: "ws-1" }]],
        [UPDATE_MESSAGE_APPROVAL, []],
    ] as const,
})

const build = async (em: MockEntityManager) => {
    fakeTransaction(em)
    const directory = mock<MentionDirectoryService>({
        nameOfMember: jest.fn((...[, , id]: [unknown, unknown, string]) =>
            Promise.resolve(id === "ha" ? "Chi Ha" : "Anh Minh"),
        ),
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
            ThreadApprovalOutcomesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: MentionDirectoryService, useValue: directory },
            { provide: WorkThreadsService, useValue: threads },
            { provide: WorkChainsService, useValue: chains },
            { provide: ThreadMessagesService, useValue: messages },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadApprovalOutcomesService), directory, threads, chains, messages }
}

const event = (outcome: ApprovalResolved["outcome"], decidedBy: string | null): ApprovalResolved => ({
    requestId: "req-1",
    outcome,
    decidedBy,
})

/** The card as the service writes it: the pending card with the changes spread over it. */
const stored = (changes: Partial<ApprovalCard>): ReadonlyArray<string> => [
    "ws-1",
    "msg-1",
    JSON.stringify({ ...PENDING, ...changes }),
]

const registerResolvedApproved = () => {
    describe("resolved: approved elsewhere", () => {
        it("leaves alone a request no thread card carries", async () => {
            const em = mockEntityManager(stubsOf({ byApproval: [] }))
            const { service, chains } = await build(em)

            await expect(service.resolved(event("approved", "ha"))).resolves.toBeUndefined()

            expect(em.query).not.toHaveBeenCalledWith(UPDATE_MESSAGE_APPROVAL, expect.anything())
            expect(chains.settleApproval).not.toHaveBeenCalled()
        })

        it("settles the card with the decider's vote on their line, the step and the thread", async () => {
            const em = mockEntityManager(stubsOf())
            const { service, chains, threads, messages } = await build(em)

            await service.resolved(event("approved", "ha"))

            expect(em.query).toHaveBeenCalledWith(
                UPDATE_MESSAGE_APPROVAL,
                stored({
                    approvers: [MINH_LINE, { ...HA_LINE, status: "approved" }],
                    outcome: "approved",
                    decidedBy: "ha",
                    decidedByName: "Chi Ha",
                    decidedAt: AT,
                }),
            )
            expect(chains.settleApproval).toHaveBeenCalledWith(
                { workspaceId: "ws-1", approvalRequestId: "req-1", outcome: "approved", decidedBy: "ha", locale: "vi" },
                expect.anything(),
            )
            expect(threads.setStatus).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", "open")
            expect(messages.append).not.toHaveBeenCalled()
        })

        it("does nothing twice when the card was already settled", async () => {
            const em = mockEntityManager(stubsOf({ locked: [rowOf({ ...PENDING, outcome: "approved" })] }))
            const { service, chains } = await build(em)

            await service.resolved(event("approved", "ha"))

            expect(em.query).not.toHaveBeenCalledWith(UPDATE_MESSAGE_APPROVAL, expect.anything())
            expect(chains.settleApproval).not.toHaveBeenCalled()
        })

        it("refuses a card whose message vanished before it was locked", async () => {
            const { service } = await build(mockEntityManager(stubsOf({ locked: [] })))

            await expect(service.resolved(event("approved", "ha"))).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MessageNotFound,
            })
        })
    })
}

const registerResolvedBadEnds = () => {
    describe("resolved: refused or expired", () => {
        it("sends a refused request back to the owner of the agent, who is tagged and gets a chain step", async () => {
            const em = mockEntityManager(stubsOf())
            const { service, messages, chains, threads } = await build(em)

            await service.resolved(event("rejected", "minh"))

            expect(em.query).toHaveBeenCalledWith(
                UPDATE_MESSAGE_APPROVAL,
                stored({
                    approvers: [{ ...MINH_LINE, status: "rejected" }, HA_LINE],
                    outcome: "rejected",
                    decidedBy: "minh",
                    decidedByName: "Anh Minh",
                    decidedAt: AT,
                }),
            )
            expect(threads.setStatus).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", "stopped")
            expect(chains.ownerTagOf).toHaveBeenCalledWith("ws-1", "agent-sales", expect.anything())
            expect(messages.append).toHaveBeenCalledWith(expect.anything(), {
                workspaceId: "ws-1",
                threadId: "thread-1",
                author: { kind: "agent", id: "agent-sales" },
                body: 'thread.owner.rejected|{"agent":"AI Sales","action":"Discount 8%"}',
                quoted: [],
                mentions: [{ kind: "member", id: "minh", name: "Anh Minh" }],
                card: null,
            })
            expect(chains.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: "hand_off",
                    actor: { kind: "agent", id: "agent-sales" },
                    target: { kind: "member", id: "minh" },
                    rule: "Customer discount",
                    action: 'thread.owner.step|{"action":"Discount 8%"}',
                }),
                expect.anything(),
            )
        })

        it("sends an expired request to the owner of the agent with nobody as the decider and no vote", async () => {
            const em = mockEntityManager(stubsOf())
            const { service, directory, messages } = await build(em)

            await service.resolved(event("expired", null))

            expect(em.query).toHaveBeenCalledWith(
                UPDATE_MESSAGE_APPROVAL,
                stored({ outcome: "expired", decidedBy: null, decidedByName: null, decidedAt: AT }),
            )
            expect(directory.nameOfMember).toHaveBeenCalledTimes(1)
            expect(messages.append).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ body: 'thread.owner.expired|{"agent":"AI Sales","action":"Discount 8%"}' }),
            )
        })
    })
}

const registerKeep = () => {
    describe("keep", () => {
        it("writes a vote that does not end the request and answers the message with it", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)
            const voted: ApprovalCard = { ...PENDING, approvers: [{ ...MINH_LINE, status: "approved" }, HA_LINE] }

            const message = await service.keep(em, rowOf(PENDING), voted)

            expect(em.query).toHaveBeenCalledWith(UPDATE_MESSAGE_APPROVAL, ["ws-1", "msg-1", JSON.stringify(voted)])
            expect(message.approval).toEqual(voted)
        })
    })
}

describe("ThreadApprovalOutcomesService", () => {
    registerResolvedApproved()
    registerResolvedBadEnds()
    registerKeep()
})
