import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { OfficeCardsService } from "@modules/domain/messages"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { OfficeRoomsErrorCode } from "./errors/office-rooms.error"
import { OfficeRoomsService } from "./office-rooms.service"
import type { RoomMemberPreviewRow, RoomRow } from "./persistence/office-rooms.rows"
import { LIST_ROOM_MEMBERS } from "./persistence/office-room-members.sql"
import {
    ENSURE_ROOMS,
    LIST_AGENT_UNREAD,
    LIST_LEAD_UNREAD,
    LIST_ROOMS,
    MARK_AGENT_READ,
    MARK_LEAD_READ,
    MARK_ROOM_READ,
    OFFICE_ROOM_SUMMARY,
} from "./persistence/office-rooms.sql"

const member = builder<WorkspaceMember>({
    userId: "u-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Mai Linh",
    status: "active",
})

const roomOf = builder<RoomRow>({
    key: "marketing",
    name: "Marketing",
    position: 3,
    unread: 1,
    last_body: "Content is ready",
    last_author: "AI Marketing",
    last_author_user_id: null,
    last_at: "2026-10-20T02:42:00+00:00",
    agent_ids: ["a-1"],
    home_agent_ids: ["a-1"],
    user_ids: ["u-1"],
    pins: [{ id: "p-1", title: "HAKUEN_Brand_Guideline.pdf", href: null, note: "Shared knowledge" }],
})

const personPreviewOf = builder<RoomMemberPreviewRow>({
    id: "u-1",
    kind: "human",
    module: null,
    name: "Mai Linh",
    avatarUrl: "https://example.com/mai.png",
})

const agentPreviewOf = builder<RoomMemberPreviewRow>({
    id: "a-1",
    kind: "agent",
    module: "content",
    name: "AI Marketing",
    avatarUrl: null,
})

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(member()) })
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
        ],
    }).compile()
    return { service: moduleRef.get(OfficeRoomsService), members, cards }
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
            last_body: "hi",
            last_author: "An",
            last_author_user_id: "u-2",
            last_at: "2026-10-20T02:00:00+00:00",
        }
        const em = mockEntityManager({
            query: [
                [OFFICE_ROOM_SUMMARY, [summary]],
                [LIST_ROOMS, [roomOf()]],
                [
                    LIST_ROOM_MEMBERS,
                    [
                        { key: null, count: 6, preview: [personPreviewOf()] },
                        { key: "marketing", count: 1, preview: [agentPreviewOf()] },
                    ],
                ],
            ],
        })
        const { service, members } = await build(em)

        const rooms = await service.rooms("u-1", "ws-1")

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(em.query).toHaveBeenCalledWith(LIST_ROOMS, ["ws-1", "u-1", "Mai Linh"])
        expect(em.query).toHaveBeenCalledWith(OFFICE_ROOM_SUMMARY, ["ws-1", "u-1", "Mai Linh"])
        expect(em.query).toHaveBeenCalledWith(LIST_ROOM_MEMBERS, ["ws-1", ["marketing"]])
        expect(em.query).toHaveBeenCalledTimes(3)
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
        const em = mockEntityManager({
            query: [
                [OFFICE_ROOM_SUMMARY, []],
                [LIST_ROOMS, []],
                [LIST_ROOM_MEMBERS, []],
            ],
        })
        const { service } = await build(em)

        await expect(service.rooms("u-1", "ws-1")).resolves.toEqual([
            officeOf({ unread: 0, last_body: null, last_author: null, last_author_user_id: null, last_at: null }),
        ])
    })
})

describe("OfficeRoomsService.rooms member previews", () => {
    it("batches every department key and supplies empty member summaries when no seats are returned", async () => {
        const rows = [roomOf(), roomOf({ key: "sales", name: "Sales" })]
        const em = mockEntityManager({
            query: [
                [OFFICE_ROOM_SUMMARY, []],
                [LIST_ROOMS, rows],
                [LIST_ROOM_MEMBERS, []],
            ],
        })
        const { service } = await build(em)

        const rooms = await service.rooms("u-1", "ws-1")

        expect(em.query).toHaveBeenCalledWith(LIST_ROOM_MEMBERS, ["ws-1", ["marketing", "sales"]])
        expect(em.query).toHaveBeenCalledTimes(3)
        expect(rooms.slice(1)).toEqual(rows.map((row) => ({ ...row, members: { count: 0, preview: [] } })))
    })

    it("does not read rooms or member photos when workspace membership is refused", async () => {
        const em = mockEntityManager()
        const { service, members } = await build(em)
        const refusal = new Error("Membership refused")
        members.require.mockRejectedValue(refusal)

        await expect(service.rooms("outsider", "ws-1")).rejects.toBe(refusal)

        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("OfficeRoomsService.markRead", () => {
    it("marks a department room read", async () => {
        const em = mockEntityManager({ query: [MARK_ROOM_READ, []] })
        const { service } = await build(em)

        await service.markRead("u-1", "ws-1", "sales")

        expect(em.query).toHaveBeenCalledWith(MARK_ROOM_READ, ["ws-1", "u-1", "sales"])
    })

    it("marks the Office room read under the empty key", async () => {
        const em = mockEntityManager({ query: [MARK_ROOM_READ, []] })
        const { service } = await build(em)

        await service.markRead("u-1", "ws-1", null)

        expect(em.query).toHaveBeenCalledWith(MARK_ROOM_READ, ["ws-1", "u-1", ""])
    })

    it("refuses a room that is not a Hub room", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.markRead("u-1", "ws-1", "lobby")).rejects.toMatchObject({
            code: OfficeRoomsErrorCode.RoomInvalid,
            params: { room: "lobby" },
        })
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("OfficeRoomsService.unread", () => {
    it("answers only the conversations with unseen lines, read as the caller", async () => {
        const em = mockEntityManager({
            query: [
                [
                    LIST_AGENT_UNREAD,
                    [
                        { id: "a-1", unread: 2 },
                        { id: "a-2", unread: 0 },
                    ],
                ],
                [
                    LIST_LEAD_UNREAD,
                    [
                        { id: "l-1", unread: 1 },
                        { id: "l-2", unread: 0 },
                    ],
                ],
            ],
        })
        const { service, members } = await build(em)

        const unread = await service.unread("u-1", "ws-1")

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(em.query).toHaveBeenCalledWith(LIST_AGENT_UNREAD, ["ws-1", "u-1", "Mai Linh"])
        expect(em.query).toHaveBeenCalledWith(LIST_LEAD_UNREAD, ["ws-1", "u-1", "Mai Linh"])
        expect(em.query).toHaveBeenCalledTimes(2)
        expect(unread).toEqual({ agents: [{ id: "a-1", unread: 2 }], leads: [{ id: "l-1", unread: 1 }] })
    })

    it("answers empty lists when nothing is unread", async () => {
        const em = mockEntityManager({
            query: [
                [LIST_AGENT_UNREAD, []],
                [LIST_LEAD_UNREAD, []],
            ],
        })
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
        const em = mockEntityManager({ query: [[MARK_AGENT_READ, [{ marked: null }]]] })
        const { service } = await build(em)

        await service.markConversationRead("u-1", "ws-1", "agent", "a-1")

        expect(em.query).toHaveBeenCalledWith(MARK_AGENT_READ, ["ws-1", "u-1", "a-1"])
    })

    it("marks a customer conversation read under the lead scope", async () => {
        const em = mockEntityManager({ query: [[MARK_LEAD_READ, [{ marked: null }]]] })
        const { service } = await build(em)

        await service.markConversationRead("u-1", "ws-1", "lead", "l-1")

        expect(em.query).toHaveBeenCalledWith(MARK_LEAD_READ, ["ws-1", "u-1", "l-1"])
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
        const em = mockEntityManager({ query: [[MARK_AGENT_READ, []]] })
        const { service } = await build(em)

        await expect(service.markConversationRead("u-1", "ws-1", "agent", "foreign")).rejects.toMatchObject({
            code: OfficeRoomsErrorCode.ConversationInvalid,
            params: { id: "foreign" },
        })
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
        const em = mockEntityManager({
            query: [
                [ENSURE_ROOMS, [{ opened: 6 }]],
                [OFFICE_ROOM_SUMMARY, []],
                [LIST_ROOMS, [roomOf(), roomOf({ key: "sales", name: "Sales" })]],
                [LIST_ROOM_MEMBERS, []],
            ],
        })
        const { service, members, cards } = await build(em)

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

    it.each([[[{ opened: 0 }]], [[]]])("posts nothing when no room was opened (%p)", async (opened) => {
        const em = mockEntityManager({
            query: [
                [ENSURE_ROOMS, opened],
                [OFFICE_ROOM_SUMMARY, []],
                [LIST_ROOMS, []],
                [LIST_ROOM_MEMBERS, []],
            ],
        })
        const { service, cards } = await build(em)

        await service.setup("u-1", "ws-1", "en")

        expect(cards.post).not.toHaveBeenCalled()
    })
})
