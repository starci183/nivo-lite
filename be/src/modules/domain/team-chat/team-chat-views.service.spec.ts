import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity } from "./persistence/entities"
import { TeamChatApprovalsService } from "./team-chat-approvals.service"
import { TeamChatFilesService } from "./team-chat-files.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatViewsService } from "./team-chat-views.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const DECISION = "71111111-1111-4111-8111-111111111111"
const AT = new Date("2026-11-06T10:00:00.000Z")

const room = Object.assign(new ChatRoomEntity(), {
    id: ROOM,
    kind: "group",
    name: "Team",
    position: 0,
    createdBy: ANA,
    createdAt: AT,
})
const seat = (memberKind: "user" | "agent", memberId: string) =>
    Object.assign(new ChatRoomMemberEntity(), {
        roomId: ROOM,
        memberKind,
        memberId,
        role: "member",
        lastReadAt: AT,
        muted: false,
    })
const card = Object.assign(new ChatRoomMessageEntity(), {
    id: MSG,
    roomId: ROOM,
    authorKind: "agent",
    authorId: BOT,
    body: "Needs approval",
    kind: "approval",
    ref: { decision_id: DECISION },
    mentions: [{ kind: "user", id: ANA }],
    attachments: [{ fileKey: "k1", name: "a.pdf", mimeType: "application/pdf", sizeBytes: 3 }],
    createdAt: AT,
    editedAt: null,
})

const build = async () => {
    const store = mock<TeamChatStoreService>()
    const people = mock<WorkspaceMembersReadService>()
    const agents = mock<AgentDirectoryService>()
    const files = mock<TeamChatFilesService>()
    const approvals = mock<TeamChatApprovalsService>()
    people.namesOf.mockResolvedValue([{ userId: ANA, displayName: "Ana" }])
    agents.activeInOrder.mockResolvedValue([{ id: BOT, name: "Bot", module: "sales", canTagAgentIds: [] }])
    store.pinnedAmong.mockResolvedValue(new Set([MSG]))
    files.urlsOf.mockResolvedValue(new Map([["k1", "https://get/k1"]]))
    approvals.statesOf.mockResolvedValue(
        new Map([
            [
                DECISION,
                { decisionId: DECISION, status: "pending", decidedByName: null, decidedAt: null, canDecide: true },
            ],
        ]),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatViewsService,
            { provide: TeamChatStoreService, useValue: store },
            { provide: WorkspaceMembersReadService, useValue: people },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: TeamChatFilesService, useValue: files },
            { provide: TeamChatApprovalsService, useValue: approvals },
        ],
    }).compile()
    return { views: moduleRef.get(TeamChatViewsService), store, people, agents, files, approvals }
}

describe("TeamChatViewsService names and messages", () => {
    it("names each person and agent once, by kind and id", async () => {
        const { views, people, agents } = await build()
        const names = await views.namesOf(WS, [
            { memberKind: "user", memberId: ANA },
            { memberKind: "user", memberId: ANA },
            { memberKind: "agent", memberId: BOT },
        ])
        expect(names).toEqual(
            new Map([
                [`user:${ANA}`, "Ana"],
                [`agent:${BOT}`, "Bot"],
            ]),
        )
        expect(people.namesOf).toHaveBeenCalledWith(WS, [ANA])
        expect(agents.activeInOrder).toHaveBeenCalledWith(WS, [BOT], 1)
    })

    it("shows messages with the names, pins, file addresses and decision states of their cards", async () => {
        const { views, store, approvals } = await build()
        const [view] = await views.messageViews(WS, [card], ANA)
        expect(view).toMatchObject({
            id: MSG,
            authorName: "Bot",
            pinned: true,
            decisionId: DECISION,
            approval: { canDecide: true },
            mentions: [{ memberId: ANA, name: "Ana" }],
            attachments: [{ fileKey: "k1", url: "https://get/k1" }],
        })
        expect(store.pinnedAmong).toHaveBeenCalledWith([MSG])
        expect(approvals.statesOf).toHaveBeenCalledWith(WS, ANA, [DECISION])
    })

    it("shows nothing for no message, and one message on its own", async () => {
        const { views, store } = await build()
        await expect(views.messageViews(WS, [], ANA)).resolves.toEqual([])
        expect(store.pinnedAmong).not.toHaveBeenCalled()
        await expect(views.viewOf(WS, card, ANA)).resolves.toMatchObject({ id: MSG, body: "Needs approval" })
    })
})

describe("TeamChatViewsService rooms", () => {
    const readRooms = async () => {
        const built = await build()
        built.store.membersOf.mockResolvedValue([seat("user", ANA), seat("agent", BOT)])
        built.store.unreadRows.mockResolvedValue([{ roomId: ROOM, unreadCount: 2, mentionCount: 1 }])
        built.store.lastMessageIds.mockResolvedValue([MSG])
        built.store.messagesByIds.mockResolvedValue([card])
        return built
    }

    it("shows nothing for no room", async () => {
        const { views, store } = await build()
        await expect(views.roomViews(WS, ANA, [])).resolves.toEqual([])
        expect(store.membersOf).not.toHaveBeenCalled()
    })

    it("shows the rooms with their members, what the viewer has unread and the newest message", async () => {
        const { views, store } = await readRooms()
        const [view] = await views.roomViews(WS, ANA, [room])
        expect(view).toMatchObject({
            id: ROOM,
            name: "Team",
            unreadCount: 2,
            mentionCount: 1,
            lastMessage: { id: MSG },
            members: [{ name: "Ana" }, { name: "Bot" }],
        })
        expect(store.membersOf).toHaveBeenCalledWith([ROOM])
        expect(store.lastMessageIds).toHaveBeenCalledWith(WS, [ROOM])
        expect(store.unreadRows).toHaveBeenCalledWith(WS, ANA, null)
    })

    it("shows one room the same way", async () => {
        const { views } = await readRooms()
        await expect(views.roomView(WS, ANA, room)).resolves.toMatchObject({ id: ROOM, unreadCount: 2 })
    })
})
