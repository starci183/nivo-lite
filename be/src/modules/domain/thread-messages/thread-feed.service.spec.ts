import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkChainsService } from "@modules/domain/work-chains"
import type { ChainView } from "@modules/domain/work-chains"
import { WorkThreadsService } from "@modules/domain/work-threads"
import type { WorkThread } from "@modules/domain/work-threads"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { MentionDirectoryService } from "./mention-directory.service"
import { ThreadMessageAuthorsService } from "./thread-message-authors.service"
import { passThroughAuthors } from "@tests/fixtures/builders/thread-message-authors.builder"
import { ThreadMessageEntity } from "./persistence/entities"
import { ThreadFeedService } from "./thread-feed.service"
import type { ThreadMessageRecord } from "./thread-messages.contracts"

const MEMBER: WorkspaceMember = {
    userId: "van",
    workspaceId: "ws-1",
    role: "staff",
    staffId: null,
    displayName: "Van",
    status: "active",
}

const THREAD: WorkThread = {
    id: "thread-1",
    workspaceId: "ws-1",
    title: "Villa booking for Ms Thao",
    leadId: "lead-1",
    orderId: null,
    status: "open",
    createdBy: "member-van",
    createdAt: "2026-10-22T02:41:00.000Z",
    updatedAt: "2026-10-22T02:41:00.000Z",
}

const messageRow = (id: string, createdAt: string): ThreadMessageRecord => ({
    id,
    thread_id: "thread-1",
    workspace_id: "ws-1",
    author_kind: "member",
    author_id: "member-van",
    author_name: "Van",
    author_role: "staff",
    body: id,
    quoted: [],
    mentions: [],
    approval: null,
    created_at: new Date(createdAt),
})

/** A manager double whose next query builder answers the given terminals. */
const managerAnswering = (answers: QueryBuilderAnswers) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder(answers)
    em.createQueryBuilder.mockReturnValueOnce(fake.builder as never)
    return { em, fake }
}

const CHAIN: ChainView = { steps: [], summary: { steps: 0, humanDecisions: 0, minutes: 0, state: "empty" } }

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(MEMBER) })
    const directory = mock<MentionDirectoryService>({ memberIdOf: jest.fn().mockResolvedValue("member-van") })
    const threads = mock<WorkThreadsService>({
        createFor: jest.fn().mockResolvedValue(THREAD),
        find: jest.fn().mockResolvedValue(THREAD),
        list: jest.fn().mockResolvedValue({ nodes: [THREAD], pageInfo: { endCursor: "cursor", hasNextPage: false } }),
    })
    const chains = mock<WorkChainsService>({ view: jest.fn().mockResolvedValue(CHAIN) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadFeedService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MentionDirectoryService, useValue: directory },
            { provide: ThreadMessageAuthorsService, useValue: passThroughAuthors() },
            { provide: WorkThreadsService, useValue: threads },
            { provide: WorkChainsService, useValue: chains },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadFeedService), members, directory, threads, chains }
}

const registerOpen = () => {
    describe("open", () => {
        it("opens a thread for a member of the workspace under the member id", async () => {
            const em = mockEntityManager()
            const { service, members, directory, threads } = await build(em)

            const thread = await service.open({
                workspaceId: "ws-1",
                userId: "van",
                title: "Villa booking for Ms Thao",
                leadId: "lead-1",
                orderId: null,
            })

            expect(members.require).toHaveBeenCalledWith("van", "ws-1")
            expect(directory.memberIdOf).toHaveBeenCalledWith(em, "ws-1", "van")
            expect(thread.id).toBe("thread-1")
            expect(threads.createFor).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                memberId: "member-van",
                title: "Villa booking for Ms Thao",
                leadId: "lead-1",
                orderId: null,
            })
        })
    })
}

const registerList = () => {
    describe("list", () => {
        it("lists the threads with the newest line of each and an empty digest for a silent one", async () => {
            const digest = {
                thread_id: "thread-1",
                last_body: "Confirmation sent.",
                last_at: new Date("2026-10-22T09:45:00+07:00"),
                message_count: 7,
                waiting_approval: false,
            }
            const { em, fake } = managerAnswering({ getRawMany: [digest] })
            const { service, threads } = await build(em)
            threads.list.mockResolvedValue({
                nodes: [THREAD, { ...THREAD, id: "thread-2" }],
                pageInfo: { endCursor: "cursor", hasNextPage: true },
            })

            const listing = await service.list("van", "ws-1", "lead-1")

            expect(threads.list).toHaveBeenCalledWith("ws-1", "lead-1", {})
            expect(em.createQueryBuilder).toHaveBeenCalledWith(ThreadMessageEntity, "m")
            expect(fake.callsOf("where")).toEqual([
                [
                    "m.workspace_id = :workspaceId AND m.thread_id = ANY(:threadIds)",
                    { workspaceId: "ws-1", threadIds: ["thread-1", "thread-2"] },
                ],
            ])
            expect(fake.callsOf("groupBy")).toEqual([["m.thread_id"]])
            expect(fake.callsOf("limit")).toEqual([[200]])
            expect(listing.nodes[0]).toMatchObject({ lastAt: "2026-10-22T02:45:00.000Z" })
            expect(listing.nodes[0]).toMatchObject({ id: "thread-1", lastBody: "Confirmation sent.", messageCount: 7 })
            expect(listing.nodes[1]).toMatchObject({ id: "thread-2", lastBody: null, messageCount: 0 })
            expect(listing.pageInfo).toEqual({ endCursor: "cursor", hasNextPage: true })
        })

        it("passes the page request after proving workspace membership", async () => {
            const { em } = managerAnswering({ getRawMany: [] })
            const { service, members, threads } = await build(em)
            const request = { first: 20, after: "cursor" }

            await service.list("van", "ws-1", null, request)

            expect(members.require).toHaveBeenCalledWith("van", "ws-1")
            expect(threads.list).toHaveBeenCalledWith("ws-1", null, request)
        })

        it("refuses a nonmember before listing threads or digests", async () => {
            const em = mockEntityManager()
            const { service, members, threads } = await build(em)
            members.require.mockRejectedValue(new Error("not a member"))

            await expect(service.list("van", "ws-1", null)).rejects.toThrow("not a member")

            expect(threads.list).not.toHaveBeenCalled()
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
}

const registerRead = () => {
    describe("read and chain", () => {
        it("answers the thread with its messages oldest first", async () => {
            const newer = messageRow("newer", "2026-10-22T09:45:00+07:00")
            const older = messageRow("older", "2026-10-22T09:41:00+07:00")
            const { em, fake } = managerAnswering({ getRawMany: [newer, older] })
            const { service, threads } = await build(em)

            const view = await service.read("van", "ws-1", "thread-1")

            expect(threads.find).toHaveBeenCalledWith("ws-1", "thread-1")
            expect(view.thread.id).toBe("thread-1")
            expect(view.messages.map((message) => message.id)).toEqual(["older", "newer"])
            expect(em.createQueryBuilder).toHaveBeenCalledWith(ThreadMessageEntity, "m")
            expect(fake.callsOf("where")).toEqual([["m.workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
            expect(fake.callsOf("andWhere")).toEqual([["m.thread_id = :threadId", { threadId: "thread-1" }]])
            expect(fake.callsOf("orderBy")).toEqual([["m.created_at", "DESC"]])
            expect(fake.callsOf("addOrderBy")).toEqual([["m.id", "DESC"]])
            expect(fake.callsOf("limit")).toEqual([[200]])
        })

        it("reads the chain of a thread of the workspace", async () => {
            const { service, threads, chains } = await build(mockEntityManager())

            await expect(service.chain("van", "ws-1", "thread-1")).resolves.toEqual(CHAIN)
            expect(threads.find).toHaveBeenCalledWith("ws-1", "thread-1")
            expect(chains.view).toHaveBeenCalledWith("ws-1", "thread-1")
        })
    })
}

describe("ThreadFeedService", () => {
    registerOpen()
    registerList()
    registerRead()
})
