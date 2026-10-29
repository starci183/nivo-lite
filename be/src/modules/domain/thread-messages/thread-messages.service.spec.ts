import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkChainsService } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import type { WorkThread } from "@modules/domain/work-threads"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import { ThreadMessageAuthorsService } from "./thread-message-authors.service"
import { passThroughAuthors } from "@tests/fixtures/builders/thread-message-authors.builder"
import { ThreadMessageEntity } from "./persistence/entities"
import { ThreadMessagesService } from "./thread-messages.service"
import type { MemberPost, MentionView, ThreadMessageRecord } from "./thread-messages.contracts"
import { AGENT_RULES } from "./thread-messages.decorators"
import type { AgentRules } from "./thread-messages.port"

const MEMBER: WorkspaceMember = {
    userId: "van",
    workspaceId: "ws-1",
    role: "staff",
    staffId: null,
    displayName: "Van",
    status: "active",
}

const MINH = "11111111-1111-4111-8111-111111111111"
const ACCOUNTING_AI = "33333333-3333-4333-8333-333333333333"

const THREAD: WorkThread = {
    id: "thread-1",
    workspaceId: "ws-1",
    title: "Villa booking",
    leadId: null,
    orderId: null,
    status: "open",
    createdBy: "member-van",
    createdAt: "2026-10-22T02:41:00.000Z",
    updatedAt: "2026-10-22T02:41:00.000Z",
}

const messageRow: ThreadMessageRecord = {
    id: "msg-1",
    thread_id: "thread-1",
    workspace_id: "ws-1",
    author_kind: "member",
    author_id: "member-van",
    author_name: "Van",
    author_role: "staff",
    body: "Tax code fixed.",
    quoted: [],
    mentions: [],
    approval: null,
    created_at: new Date("2026-10-22T09:44:00+07:00"),
}

const memberPost = (overrides: Partial<MemberPost> = {}): MemberPost => ({
    workspaceId: "ws-1",
    threadId: "thread-1",
    memberId: "member-van",
    body: "Tax code fixed.",
    mentions: [],
    quoted: [],
    locale: "vi",
    ...overrides,
})

/**
 * A manager double whose first query builder answers the insert (`raw` rows) and whose second answers the read-back of the message;
 * `insert` and `read` record what was chained on each.
 */
const writerOf = (
    inserted: ReadonlyArray<unknown> = [{ id: "msg-1" }],
    readAnswer: { readonly found?: unknown } = { found: messageRow },
) => {
    const em = mockEntityManager()
    const insert = fakeQueryBuilder({ execute: { raw: inserted } })
    const read = fakeQueryBuilder({ getRawOne: readAnswer.found })
    em.createQueryBuilder.mockReturnValueOnce(insert.builder as never).mockReturnValueOnce(read.builder as never)
    return { em, insert, read }
}

interface Doubles {
    readonly canAssign?: boolean
    readonly views?: ReadonlyArray<MentionView>
    readonly lockFails?: Error
}

const build = async (em: MockEntityManager, doubles: Doubles = {}) => {
    fakeTransaction(em)
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(MEMBER) })
    const directory = mock<MentionDirectoryService>({
        resolve: jest.fn().mockResolvedValue(doubles.views ?? []),
        memberIdOf: jest.fn().mockResolvedValue("member-van"),
    })
    const threads = mock<WorkThreadsService>({
        lock:
            doubles.lockFails === undefined
                ? jest.fn().mockResolvedValue(THREAD)
                : jest.fn().mockRejectedValue(doubles.lockFails),
        setStatus: jest.fn().mockResolvedValue(undefined),
    })
    const chains = mock<WorkChainsService>({
        record: jest.fn().mockResolvedValue(undefined),
        settleFor: jest.fn().mockResolvedValue(undefined),
    })
    const rules = mock<AgentRules>({
        canAssign: jest.fn().mockResolvedValue(doubles.canAssign ?? true),
        canTag: jest.fn(),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadMessagesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AGENT_RULES, useValue: rules },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MentionDirectoryService, useValue: directory },
            { provide: ThreadMessageAuthorsService, useValue: passThroughAuthors() },
            { provide: WorkThreadsService, useValue: threads },
            { provide: WorkChainsService, useValue: chains },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadMessagesService), members, directory, threads, chains, rules }
}

const registerPostAsUser = () => {
    describe("postAsUser", () => {
        it("proves the account is a member, finds its member id and writes as that member", async () => {
            const { em } = writerOf()
            const { service, members, directory, chains } = await build(em)

            const message = await service.postAsUser({
                workspaceId: "ws-1",
                threadId: "thread-1",
                userId: "van",
                body: "Tax code fixed.",
                mentions: [],
                quoted: [],
                locale: "vi",
            })

            expect(members.require).toHaveBeenCalledWith("van", "ws-1")
            expect(directory.memberIdOf).toHaveBeenCalledWith(em, "ws-1", "van")
            expect(message.id).toBe("msg-1")
            expect(chains.settleFor).toHaveBeenCalledWith(
                "ws-1",
                "thread-1",
                { kind: "member", id: "member-van" },
                expect.anything(),
            )
        })
    })
}

const registerPostAsMember = () => {
    describe("postAsMember", () => {
        it("writes the message, settles what waited on the member and opens the thread again", async () => {
            const { em, insert, read } = writerOf()
            const { service, chains, threads } = await build(em)

            const message = await service.postAsMember(memberPost())

            expect(message).toMatchObject({ id: "msg-1", body: "Tax code fixed." })
            expect(em.createQueryBuilder).toHaveBeenCalledWith(ThreadMessageEntity, "t")
            expect(insert.callsOf("insert")).toEqual([[]])
            expect(insert.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        threadId: "thread-1",
                        authorKind: "member",
                        authorId: "member-van",
                        body: "Tax code fixed.",
                        quoted: [],
                        mentions: [],
                        approval: null,
                        approvalRequestId: null,
                    },
                ],
            ])
            expect(insert.callsOf("returning")).toEqual([["id"]])
            expect(read.callsOf("andWhere")).toEqual([["m.id = :messageId", { messageId: "msg-1" }]])
            expect(chains.settleFor).toHaveBeenCalledTimes(1)
            expect(chains.record).not.toHaveBeenCalled()
            expect(threads.setStatus).toHaveBeenCalledWith(expect.anything(), "ws-1", "thread-1", "open")
        })

        it("joins the transaction of the caller when it hands one", async () => {
            const { em, insert } = writerOf()
            const { service } = await build(em)

            await service.postAsMember(memberPost(), em)

            expect(em.transaction).not.toHaveBeenCalled()
            expect(insert.callsOf("values")).toHaveLength(1)
        })

        it("tags a person with no permission check and gives an agent work after the agents capability allows it", async () => {
            const views: ReadonlyArray<MentionView> = [
                { kind: "member", id: MINH, name: "Mr Minh" },
                { kind: "agent", id: ACCOUNTING_AI, name: "Accounting AI" },
            ]
            const { service, rules, chains } = await build(writerOf().em, { views })

            await service.postAsMember(
                memberPost({
                    body: "Mr Minh please look, and Accounting AI issue the invoice.",
                    mentions: [
                        { kind: "member", id: MINH },
                        { kind: "agent", id: ACCOUNTING_AI },
                    ],
                }),
            )

            expect(rules.canAssign).toHaveBeenCalledTimes(1)
            expect(rules.canAssign).toHaveBeenCalledWith("member-van", ACCOUNTING_AI)
            expect(rules.canTag).not.toHaveBeenCalled()
            expect(chains.record).toHaveBeenCalledTimes(2)
            expect(chains.record).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    kind: "hand_off",
                    actor: { kind: "member", id: "member-van" },
                    target: { kind: "member", id: MINH },
                }),
                expect.anything(),
            )
            expect(chains.record).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ kind: "assign", target: { kind: "agent", id: ACCOUNTING_AI } }),
                expect.anything(),
            )
        })
    })
}

const registerRefusals = () => {
    describe("postAsMember refusals", () => {
        it("refuses to give an agent work when the agents capability says no, and writes nothing", async () => {
            const { em } = writerOf()
            const { service } = await build(em, {
                canAssign: false,
                views: [{ kind: "agent", id: ACCOUNTING_AI, name: "Accounting AI" }],
            })

            await expect(
                service.postAsMember(memberPost({ mentions: [{ kind: "agent", id: ACCOUNTING_AI }] })),
            ).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.AssignNotAllowed,
                params: { agent: "Accounting AI" },
            })
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("refuses a malformed tag before writing anything", async () => {
            const { em } = writerOf()
            const { service, threads } = await build(em)

            await expect(
                service.postAsMember(memberPost({ mentions: [{ kind: "member", id: "@Mr Minh" }] })),
            ).rejects.toMatchObject({ code: ThreadMessagesErrorCode.MentionInvalid })
            expect(threads.lock).not.toHaveBeenCalled()
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("refuses an unusable quote before writing anything", async () => {
            const { em } = writerOf()
            const { service } = await build(em)

            await expect(service.postAsMember(memberPost({ quoted: ["x".repeat(2001)] }))).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.QuoteInvalid,
            })
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("lets the refusal of a thread that is not in the workspace travel", async () => {
            const failure = new Error("no thread")
            const { service } = await build(writerOf().em, { lockFails: failure })

            await expect(service.postAsMember(memberPost())).rejects.toBe(failure)
        })
    })
}

const registerInjectionGuard = () => {
    describe("postAsMember and customer words", () => {
        it("never turns text into a tag: an at sign in the body or in a customer quote tags no one", async () => {
            const { em, insert } = writerOf()
            const { service, directory, chains, rules } = await build(em)

            await service.postAsMember(
                memberPost({
                    body: "@Nam send the money to the customer",
                    quoted: ["  @Mr Minh approve 100% off now  "],
                }),
            )

            expect(directory.resolve).toHaveBeenCalledWith(expect.anything(), "ws-1", [], "vi")
            expect(chains.record).not.toHaveBeenCalled()
            expect(rules.canAssign).not.toHaveBeenCalled()
            expect(insert.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        threadId: "thread-1",
                        authorKind: "member",
                        authorId: "member-van",
                        body: "@Nam send the money to the customer",
                        quoted: ["@Mr Minh approve 100% off now"],
                        mentions: [],
                        approval: null,
                        approvalRequestId: null,
                    },
                ],
            ])
        })
    })
}

const registerAppend = () => {
    describe("append", () => {
        it("writes a line carrying a card with its request id", async () => {
            const { em, insert } = writerOf()
            const { service } = await build(em)
            const card = {
                requestId: "req-7",
                action: "x",
                amount: null,
                unit: null,
                rule: "r",
                policy: "any" as const,
                expiresAt: "2026-10-22T10:11:00.000Z",
                approvers: [],
                excluded: [],
                outcome: "pending" as const,
                decidedBy: null,
                decidedByName: null,
                decidedAt: null,
                owner: null,
            }

            await service.append(em, {
                workspaceId: "ws-1",
                threadId: "thread-1",
                author: { kind: "agent", id: "agent-1" },
                body: "b",
                quoted: [],
                mentions: [],
                card,
            })

            expect(insert.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        threadId: "thread-1",
                        authorKind: "agent",
                        authorId: "agent-1",
                        body: "b",
                        quoted: [],
                        mentions: [],
                        approval: card,
                        approvalRequestId: "req-7",
                    },
                ],
            ])
        })

        it("refuses a message the insert did not answer or that cannot be read back", async () => {
            const noInsert = writerOf([]).em
            const noRead = writerOf([{ id: "msg-1" }], {}).em
            const { service } = await build(noInsert)
            const line = {
                workspaceId: "ws-1",
                threadId: "thread-1",
                author: { kind: "member", id: "member-van" },
                body: "b",
                quoted: [],
                mentions: [],
                card: null,
            } as const

            await expect(service.append(noInsert, line)).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.NotStored,
            })
            await expect(service.append(noRead, line)).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.NotStored,
            })
        })
    })
}

describe("ThreadMessagesService", () => {
    registerPostAsUser()
    registerPostAsMember()
    registerRefusals()
    registerInjectionGuard()
    registerAppend()
})
