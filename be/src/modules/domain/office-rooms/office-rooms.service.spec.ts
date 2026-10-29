import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import type { MockEntityManager } from "@starci/jest-preset"
import { ChatActivityService } from "@modules/domain/chat-activity"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { OfficeCardsService } from "@modules/domain/messages"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { OfficeRoomsErrorCode } from "./errors/office-rooms.error"
import { OfficeRoomsService } from "./office-rooms.service"
import { OfficeRoomMembersService } from "./office-room-members.service"
import { OfficeRoomReadsService } from "./office-room-reads.service"
import type { RoomMembersView, RoomMemberPreviewView } from "./office-rooms.contracts"
import type { AgentConversationFacts, RoomFacts } from "./office-rooms.facts"

/** The statements `callDbFunction` runs. */
const MARK_ROOM_READ = "SELECT * FROM public.mark_office_room_read($1, $2, $3)"
const ENSURE_ROOMS = "SELECT * FROM public.ensure_office_rooms($1)"

/** Makes the next query builder answer whether the agent or lead belongs to the workspace. */
const answerBelonging = (em: MockEntityManager, belongs: boolean) => {
    const read = fakeQueryBuilder({ getExists: belongs })
    answerQueryBuilders(em, read)
    return read
}

const member = builder<WorkspaceMember>({
    userId: "u-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Mai Linh",
    status: "active",
})

const roomOf = builder<RoomFacts>({
    key: "marketing",
    name: "Marketing",
    position: 3,
    unread: 1,
    unread_mention_bodies: ["Please review @linh"],
    last_body: "Content is ready",
    last_author: "AI Marketing",
    last_author_user_id: null,
    last_at: "2026-10-20T02:42:00+00:00",
    agent_ids: ["a-1"],
    home_agent_ids: ["a-1"],
    user_ids: ["u-1"],
    pins: [{ id: "p-1", title: "HAKUEN_Brand_Guideline.pdf", href: null, note: "Shared knowledge" }],
})

const personPreviewOf = builder<RoomMemberPreviewView>({
    id: "u-1",
    kind: "human",
    module: null,
    name: "Mai Linh",
    avatarUrl: "https://example.com/mai.png",
})

const agentPreviewOf = builder<RoomMemberPreviewView>({
    id: "a-1",
    kind: "agent",
    module: "content",
    name: "AI Marketing",
    avatarUrl: null,
})

const agentConversationOf = builder<AgentConversationFacts>({
    id: "a-1",
    unread: 0,
    last_body: null,
    last_at: null,
    last_author_id: null,
    last_author: null,
})

/** The member views a read answers, keyed by room key (null is the Office room). */
const viewsOf = (entries: ReadonlyArray<readonly [string | null, RoomMembersView]>) => new Map(entries)

const build = async (entityManager: MockEntityManager) => {
    const reads = mock<OfficeRoomReadsService>({
        summary: jest.fn().mockResolvedValue(undefined),
        rooms: jest.fn().mockResolvedValue([]),
        agentConversations: jest.fn().mockResolvedValue([]),
        leadConversations: jest.fn().mockResolvedValue([]),
    })
    const seats = mock<OfficeRoomMembersService>({ read: jest.fn().mockResolvedValue(viewsOf([])) })
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(member()) })
    const activity = mock<ChatActivityService>()
    const cards = mock<OfficeCardsService>({ post: jest.fn().mockResolvedValue({ id: "m-1", room: null }) })
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params: Readonly<Record<string, string>>) => `[${key}]${params.names ?? ""}`),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeRoomsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: OfficeCardsService, useValue: cards },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: ChatActivityService, useValue: activity },
            { provide: OfficeRoomReadsService, useValue: reads },
            { provide: OfficeRoomMembersService, useValue: seats },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeRoomsService), members, cards, activity, reads, seats }
}

const officeOf = (summary: Record<string, unknown>) => ({
    key: null,
    name: "",
    position: 0,
    agent_ids: [],
    home_agent_ids: [],
    user_ids: [],
    pins: [],
    members: { count: 0, preview: [] },
    ...summary,
})

describe("OfficeRoomsService.rooms", () => {
    it("answers the Office room first, then the department rooms, read as the caller", async () => {
        const summary = {
            unread: 3,
            unread_mention_bodies: ["Earlier request for @Mai Linh", "Please review @linh"],
            last_body: "hi",
            last_author: "An",
            last_author_user_id: "u-2",
            last_at: "2026-10-20T02:00:00+00:00",
        }
        const em = mockEntityManager()
        const { service, members, reads, seats } = await build(em)
        reads.summary.mockResolvedValue(summary)
        reads.rooms.mockResolvedValue([roomOf()])
        seats.read.mockResolvedValue(
            viewsOf([
                [null, { count: 6, preview: [personPreviewOf()] }],
                ["marketing", { count: 1, preview: [agentPreviewOf()] }],
            ]),
        )

        const rooms = await service.rooms("u-1", "ws-1")

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(reads.rooms).toHaveBeenCalledWith("ws-1", "u-1", "Mai Linh")
        expect(reads.summary).toHaveBeenCalledWith("ws-1", "u-1", "Mai Linh")
        expect(seats.read).toHaveBeenCalledWith("ws-1", ["marketing"])
        expect(em.query).not.toHaveBeenCalled()
        expect(rooms).toEqual([
            officeOf({
                ...summary,
                members: { count: 6, preview: [personPreviewOf()] },
            }),
            {
                ...roomOf(),
                members: { count: 1, preview: [agentPreviewOf()] },
            },
        ])
    })

    it("answers an empty Office room when the summary reads nothing", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.rooms("u-1", "ws-1")).resolves.toEqual([
            officeOf({
                unread: 0,
                unread_mention_bodies: [],
                last_body: null,
                last_author: null,
                last_author_user_id: null,
                last_at: null,
            }),
        ])
    })
})

describe("OfficeRoomsService.rooms member previews", () => {
    it("batches every department key and supplies empty member summaries when no seats are returned", async () => {
        const rows = [roomOf(), roomOf({ key: "sales", name: "Sales" })]
        const em = mockEntityManager()
        const { service, reads, seats } = await build(em)
        reads.rooms.mockResolvedValue(rows)

        const rooms = await service.rooms("u-1", "ws-1")

        expect(seats.read).toHaveBeenCalledWith("ws-1", ["marketing", "sales"])
        expect(seats.read).toHaveBeenCalledTimes(1)
        expect(rooms.slice(1)).toEqual(rows.map((row) => ({ ...row, members: { count: 0, preview: [] } })))
    })

    it("does not read rooms or member photos when workspace membership is refused", async () => {
        const em = mockEntityManager()
        const { service, members, reads, seats } = await build(em)
        const refusal = new Error("Membership refused")
        members.require.mockRejectedValue(refusal)

        await expect(service.rooms("outsider", "ws-1")).rejects.toBe(refusal)

        expect(em.query).not.toHaveBeenCalled()
        expect(reads.rooms).not.toHaveBeenCalled()
        expect(seats.read).not.toHaveBeenCalled()
    })
})

describe("OfficeRoomsService.markRead", () => {
    it("marks a department room read", async () => {
        const em = mockEntityManager({ query: [MARK_ROOM_READ, []] })
        const { service, activity } = await build(em)

        await service.markRead("u-1", "ws-1", "sales")

        expect(em.query).toHaveBeenCalledWith(MARK_ROOM_READ, ["ws-1", "u-1", "sales"])
        expect(activity.receipt.mock.calls).toEqual([["ws-1", "room:sales"]])
        expect(activity.unread.mock.calls).toEqual([["ws-1", "room:sales", "u-1"]])
    })

    it("marks the Office room read under the empty key", async () => {
        const em = mockEntityManager({ query: [MARK_ROOM_READ, []] })
        const { service, activity } = await build(em)

        await service.markRead("u-1", "ws-1", null)

        expect(em.query).toHaveBeenCalledWith(MARK_ROOM_READ, ["ws-1", "u-1", ""])
        expect(activity.receipt.mock.calls).toEqual([["ws-1", "room:office"]])
    })

    it("refuses a room that is not a Hub room", async () => {
        const em = mockEntityManager()
        const { service, activity } = await build(em)

        await expect(service.markRead("u-1", "ws-1", "lobby")).rejects.toMatchObject({
            code: OfficeRoomsErrorCode.RoomInvalid,
            params: { room: "lobby" },
        })
        expect(em.query).not.toHaveBeenCalled()
        expect(activity.receipt).not.toHaveBeenCalled()
    })
})

describe("OfficeRoomsService.unread agent conversations", () => {
    it("answers every agent conversation with its newest line and only the unread customer ones", async () => {
        const em = mockEntityManager()
        const { service, members, reads } = await build(em)
        reads.agentConversations.mockResolvedValue([
            agentConversationOf({
                unread: 2,
                last_body: "hello",
                last_at: "2026-10-20T02:42:00+00:00",
                last_author_id: "u-1",
                last_author: "Mai Linh",
            }),
            agentConversationOf({ id: "a-2" }),
        ])
        reads.leadConversations.mockResolvedValue([
            { id: "l-1", unread: 1 },
            { id: "l-2", unread: 0 },
        ])

        const unread = await service.unread("u-1", "ws-1")

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(reads.agentConversations).toHaveBeenCalledWith("ws-1", "u-1", "Mai Linh")
        expect(reads.leadConversations).toHaveBeenCalledWith("ws-1", "u-1", "Mai Linh")
        expect(em.query).not.toHaveBeenCalled()
        expect(unread).toEqual({
            agents: [
                {
                    id: "a-1",
                    unread: 2,
                    last: {
                        body: "hello",
                        at: "2026-10-20T02:42:00+00:00",
                        authorId: "u-1",
                        author: "Mai Linh",
                    },
                },
                { id: "a-2", unread: 0, last: null },
            ],
            leads: [{ id: "l-1", unread: 1 }],
        })
    })

    it("answers an empty body for a conversation whose newest line reads no text", async () => {
        const em = mockEntityManager()
        const { service, reads } = await build(em)
        reads.agentConversations.mockResolvedValue([agentConversationOf({ last_at: "2026-10-20T02:42:00+00:00" })])

        await expect(service.unread("u-1", "ws-1")).resolves.toEqual({
            agents: [
                {
                    id: "a-1",
                    unread: 0,
                    last: { body: "", at: "2026-10-20T02:42:00+00:00", authorId: null, author: null },
                },
            ],
            leads: [],
        })
    })
})

describe("OfficeRoomsService.unread", () => {
    it("answers empty lists when nothing is unread", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.unread("u-1", "ws-1")).resolves.toEqual({ agents: [], leads: [] })
    })

    it("does not read counts when workspace membership is refused", async () => {
        const em = mockEntityManager()
        const { service, members } = await build(em)
        const refusal = new Error("Membership refused")
        members.require.mockRejectedValue(refusal)

        await expect(service.unread("outsider", "ws-1")).rejects.toBe(refusal)

        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("OfficeRoomsService.markConversationRead", () => {
    it("marks an agent conversation read under the agent scope", async () => {
        const em = mockEntityManager({ query: [MARK_ROOM_READ, []] })
        fakeTransaction(em)
        const belongs = answerBelonging(em, true)
        const { service, activity } = await build(em)

        await service.markConversationRead("u-1", "ws-1", "agent", "a-1")

        expect(belongs.argsOf("from")).toEqual([["public.agents", "t"]])
        expect(belongs.argsOf("where")).toEqual([
            ["t.workspace_id = :workspaceId AND t.id::text = :id", { workspaceId: "ws-1", id: "a-1" }],
        ])
        expect(em.query).toHaveBeenCalledWith(MARK_ROOM_READ, ["ws-1", "u-1", "agent:a-1"])
        expect(activity.unread.mock.calls).toEqual([["ws-1", "agent:a-1", "u-1"]])
    })

    it("marks a customer conversation read under the lead scope", async () => {
        const em = mockEntityManager({ query: [MARK_ROOM_READ, []] })
        fakeTransaction(em)
        const belongs = answerBelonging(em, true)
        const { service } = await build(em)

        await service.markConversationRead("u-1", "ws-1", "lead", "l-1")

        expect(belongs.argsOf("from")).toEqual([["public.leads", "t"]])
        expect(em.query).toHaveBeenCalledWith(MARK_ROOM_READ, ["ws-1", "u-1", "lead:l-1"])
    })

    it("refuses a kind that is not a direct conversation and writes nothing", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.markConversationRead("u-1", "ws-1", "room", "sales")).rejects.toMatchObject({
            code: OfficeRoomsErrorCode.ConversationInvalid,
            params: { id: "sales" },
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("refuses a conversation id that names no agent or lead of the workspace", async () => {
        const em = mockEntityManager()
        fakeTransaction(em)
        answerBelonging(em, false)
        const { service, activity } = await build(em)

        await expect(service.markConversationRead("u-1", "ws-1", "agent", "foreign")).rejects.toMatchObject({
            code: OfficeRoomsErrorCode.ConversationInvalid,
            params: { id: "foreign" },
        })
        expect(em.query).not.toHaveBeenCalled()
        expect(activity.unread).not.toHaveBeenCalled()
    })

    it("does not mark anything when workspace membership is refused", async () => {
        const em = mockEntityManager()
        const { service, members } = await build(em)
        const refusal = new Error("Membership refused")
        members.require.mockRejectedValue(refusal)

        await expect(service.markConversationRead("outsider", "ws-1", "agent", "a-1")).rejects.toBe(refusal)

        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("OfficeRoomsService.setup", () => {
    it("opens the rooms as a manager, announces them in the Office room and answers them", async () => {
        const em = mockEntityManager({ query: [ENSURE_ROOMS, [{ ensure_office_rooms: 6 }]] })
        const { service, members, cards, reads } = await build(em)
        reads.rooms.mockResolvedValue([roomOf(), roomOf({ key: "sales", name: "Sales" })])

        const rooms = await service.setup("u-1", "ws-1", "vi")

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1", ["owner", "manager"])
        expect(em.query).toHaveBeenCalledWith(ENSURE_ROOMS, ["ws-1"])
        expect(rooms).toHaveLength(3)
        expect(cards.post).toHaveBeenCalledWith(
            { workspaceId: "ws-1" },
            {
                room: null,
                agentId: null,
                authorName: "NIVO",
                body: "[officeRooms.openedTitle]",
                leadId: null,
                workItemId: null,
                card: {
                    v: 1,
                    type: "handoff_note",
                    title: "[officeRooms.openedTitle]",
                    body: "[officeRooms.openedBody]Marketing, Sales",
                },
            },
        )
    })

    it.each([[[{ ensure_office_rooms: 0 }]], [[]]])("posts nothing when no room was opened (%p)", async (opened) => {
        const em = mockEntityManager({ query: [ENSURE_ROOMS, opened] })
        const { service, cards } = await build(em)

        await service.setup("u-1", "ws-1", "en")

        expect(cards.post).not.toHaveBeenCalled()
    })
})
