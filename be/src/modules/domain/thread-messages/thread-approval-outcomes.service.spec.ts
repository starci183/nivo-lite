import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkChainsService } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import { ThreadMessageEntity } from "./persistence/entities"
import { ThreadApprovalOutcomesService } from "./thread-approval-outcomes.service"
import { ThreadMessagesService } from "./thread-messages.service"
import type { ApprovalCard, ApprovalResolved, CardApprover, ThreadMessageRecord } from "./thread-messages.contracts"

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

const rowOf = (approval: ApprovalCard | null): ThreadMessageRecord => ({
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
    created_at: new Date("2026-10-22T09:41:00+07:00"),
})

interface Answers {
    /** The message as the lock finds it; empty when it vanished. */
    readonly locked?: ReadonlyArray<ThreadMessageRecord>
    /** The message that carries the request; null when no card carries it. */
    readonly byApproval?: ThreadMessageEntity | null
}

/** The manager double: the carrying message is found by entity, the lock is a query builder, the card is updated by entity. */
const managerOf = (answers: Answers = {}) => {
    const em = mockEntityManager({
        findOne: [
            ThreadMessageEntity,
            answers.byApproval === undefined
                ? Object.assign(new ThreadMessageEntity(), { id: "msg-1", workspaceId: "ws-1" })
                : answers.byApproval,
        ],
        update: [ThreadMessageEntity, { affected: 1, raw: [], generatedMaps: [] }],
    })
    const lock = fakeQueryBuilder({ getRawOne: (answers.locked ?? [rowOf(PENDING)])[0] })
    em.createQueryBuilder.mockReturnValue(lock.builder as never)
    return { em, lock }
}

const build = async (em: MockEntityManager, claimWon = true) => {
    fakeTransaction(em)
    const inbox = mock<Inbox>({ claim: jest.fn().mockResolvedValue(claimWon) })
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
            { provide: INBOX, useValue: inbox },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: MentionDirectoryService, useValue: directory },
            { provide: WorkThreadsService, useValue: threads },
            { provide: WorkChainsService, useValue: chains },
            { provide: ThreadMessagesService, useValue: messages },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadApprovalOutcomesService), inbox, directory, threads, chains, messages }
}

/** The delivery key the bus hands the reactor. */
const CLAIM = { consumer: "approval_resolved__thread_outcomes", dedupeKey: "req-1" }

const event = (outcome: ApprovalResolved["outcome"], decidedBy: string | null): ApprovalResolved => ({
    requestId: "req-1",
    outcome,
    decidedBy,
})

/** The columns the service writes: the pending card with the changes spread over it. */
const stored = (changes: Partial<ApprovalCard>) => ({ approval: { ...PENDING, ...changes } })

/** The row the card update targets. */
const CARD_ROW = { workspaceId: "ws-1", id: "msg-1" }

const registerResolvedApproved = () => {
    describe("resolved: approved elsewhere", () => {
        it("leaves alone a request no thread card carries", async () => {
            const { em } = managerOf({ byApproval: null })
            const { service, chains } = await build(em)

            await expect(service.resolved(event("approved", "ha"), CLAIM)).resolves.toBeUndefined()

            expect(em.update).not.toHaveBeenCalled()
            expect(chains.settleApproval).not.toHaveBeenCalled()
        })

        it("settles the card with the decider's vote on their line, the step and the thread", async () => {
            const { em, lock } = managerOf()
            const { service, chains, threads, messages } = await build(em)

            await service.resolved(event("approved", "ha"), CLAIM)

            expect(em.findOne).toHaveBeenCalledWith(ThreadMessageEntity, {
                select: { id: true, workspaceId: true },
                where: { approvalRequestId: "req-1" },
            })
            expect(lock.callsOf("setLock")).toEqual([["pessimistic_write", undefined, ["m"]]])
            expect(lock.callsOf("andWhere")).toEqual([["m.id = :messageId", { messageId: "msg-1" }]])
            expect(em.update).toHaveBeenCalledWith(
                ThreadMessageEntity,
                CARD_ROW,
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

        it("claims the delivery in the transaction of the effect and settles nothing for a redelivery", async () => {
            const { em } = managerOf()
            const { service, inbox, chains } = await build(em, false)

            await service.resolved(event("approved", "ha"), CLAIM)

            expect(inbox.claim).toHaveBeenCalledWith("approval_resolved__thread_outcomes", "req-1", expect.anything())
            expect(em.update).not.toHaveBeenCalled()
            expect(chains.settleApproval).not.toHaveBeenCalled()
        })

        it("does nothing twice when the card was already settled", async () => {
            const { em } = managerOf({ locked: [rowOf({ ...PENDING, outcome: "approved" })] })
            const { service, chains } = await build(em)

            await service.resolved(event("approved", "ha"), CLAIM)

            expect(em.update).not.toHaveBeenCalled()
            expect(chains.settleApproval).not.toHaveBeenCalled()
        })

        it("refuses a card whose message vanished before it was locked", async () => {
            const { service } = await build(managerOf({ locked: [] }).em)

            await expect(service.resolved(event("approved", "ha"), CLAIM)).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MessageNotFound,
            })
        })
    })
}

const registerResolvedBadEnds = () => {
    describe("resolved: refused or expired", () => {
        it("sends a refused request back to the owner of the agent, who is tagged and gets a chain step", async () => {
            const { em } = managerOf()
            const { service, messages, chains, threads } = await build(em)

            await service.resolved(event("rejected", "minh"), CLAIM)

            expect(em.update).toHaveBeenCalledWith(
                ThreadMessageEntity,
                CARD_ROW,
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
            const { em } = managerOf()
            const { service, directory, messages } = await build(em)

            await service.resolved(event("expired", null), CLAIM)

            expect(em.update).toHaveBeenCalledWith(
                ThreadMessageEntity,
                CARD_ROW,
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
            const { em } = managerOf()
            const { service } = await build(em)
            const voted: ApprovalCard = { ...PENDING, approvers: [{ ...MINH_LINE, status: "approved" }, HA_LINE] }

            const message = await service.keep(em, rowOf(PENDING), voted)

            expect(em.update).toHaveBeenCalledWith(ThreadMessageEntity, CARD_ROW, { approval: voted })
            expect(message.approval).toEqual(voted)
        })
    })
}

describe("ThreadApprovalOutcomesService", () => {
    registerResolvedApproved()
    registerResolvedBadEnds()
    registerKeep()
})
