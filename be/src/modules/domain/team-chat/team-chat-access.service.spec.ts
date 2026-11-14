import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { MemberSeatRecord, WorkspaceRole } from "@modules/domain/workspace-members"
import { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity } from "./persistence/entities"
import { TeamChatAccessService } from "./team-chat-access.service"
import { TeamChatStoreService } from "./team-chat-store.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const BEN = "23333333-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"

const room = Object.assign(new ChatRoomEntity(), { id: ROOM, workspaceId: WS })
const message = Object.assign(new ChatRoomMessageEntity(), { id: MSG })
const seatOf = (role: WorkspaceRole): MemberSeatRecord => ({
    memberId: "seat-1",
    userId: ANA,
    role,
    displayName: "Ana",
    status: "active",
})
const roomSeat = (role: "owner" | "member") => Object.assign(new ChatRoomMemberEntity(), { role })

const build = async () => {
    const store = mock<TeamChatStoreService>()
    const seats = mock<WorkspaceMemberSeatsService>()
    const agents = mock<AgentDirectoryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatAccessService,
            { provide: TeamChatStoreService, useValue: store },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return { access: moduleRef.get(TeamChatAccessService), store, seats, agents }
}

describe("TeamChatAccessService owners and rooms", () => {
    it("knows an owner of the workspace by the role of the active seat", async () => {
        const { access, seats } = await build()
        seats.activeSeatOfUser.mockResolvedValueOnce(seatOf("owner"))
        await expect(access.isOwner(WS, ANA)).resolves.toBe(true)
        seats.activeSeatOfUser.mockResolvedValueOnce(seatOf("staff"))
        await expect(access.isOwner(WS, ANA)).resolves.toBe(false)
        seats.activeSeatOfUser.mockResolvedValueOnce(null)
        await expect(access.isOwner(WS, ANA)).resolves.toBe(false)
    })

    it("shows a room to a member of it, and to an owner of the workspace, and to nobody else", async () => {
        const { access, store, seats } = await build()
        store.roomById.mockResolvedValue(room)
        store.memberOf.mockResolvedValueOnce(roomSeat("member"))
        await expect(access.visibleRoom(WS, ANA, ROOM)).resolves.toBe(room)
        expect(store.memberOf).toHaveBeenCalledWith(ROOM, { memberKind: "user", memberId: ANA })
        store.memberOf.mockResolvedValueOnce(null)
        seats.activeSeatOfUser.mockResolvedValueOnce(seatOf("owner"))
        await expect(access.visibleRoom(WS, ANA, ROOM)).resolves.toBe(room)
        store.memberOf.mockResolvedValueOnce(null)
        seats.activeSeatOfUser.mockResolvedValueOnce(seatOf("staff"))
        await expect(access.visibleRoom(WS, ANA, ROOM)).resolves.toBeNull()
    })

    it("shows nothing for a room the workspace does not have", async () => {
        const { access, store } = await build()
        store.roomById.mockResolvedValue(null)
        await expect(access.visibleRoom(WS, ANA, ROOM)).resolves.toBeNull()
        expect(store.memberOf).not.toHaveBeenCalled()
    })

    it("lets an owner of the workspace or of the room change the members, and nobody else", async () => {
        const { access, store, seats } = await build()
        seats.activeSeatOfUser.mockResolvedValueOnce(seatOf("owner"))
        await expect(access.mayManage(WS, ANA, room)).resolves.toBe(true)
        expect(store.memberOf).not.toHaveBeenCalled()
        seats.activeSeatOfUser.mockResolvedValue(seatOf("staff"))
        store.memberOf.mockResolvedValueOnce(roomSeat("owner"))
        await expect(access.mayManage(WS, ANA, room)).resolves.toBe(true)
        store.memberOf.mockResolvedValueOnce(roomSeat("member"))
        await expect(access.mayManage(WS, ANA, room)).resolves.toBe(false)
        store.memberOf.mockResolvedValueOnce(null)
        await expect(access.mayManage(WS, ANA, room)).resolves.toBe(false)
    })

    it("answers the message only to a person who sees its room", async () => {
        const { access, store } = await build()
        store.roomById.mockResolvedValue(room)
        store.memberOf.mockResolvedValueOnce(roomSeat("member"))
        store.messageIn.mockResolvedValue(message)
        await expect(access.pinnable(WS, ANA, ROOM, MSG)).resolves.toBe(message)
        expect(store.messageIn).toHaveBeenCalledWith(WS, ROOM, MSG)
        store.roomById.mockResolvedValue(null)
        await expect(access.pinnable(WS, ANA, ROOM, MSG)).resolves.toBeNull()
    })
})

describe("TeamChatAccessService known members", () => {
    it("knows people and agents that are active in the workspace, each agent once", async () => {
        const { access, seats, agents } = await build()
        seats.activeUsers.mockResolvedValue([
            { userId: ANA, displayName: "Ana" },
            { userId: BEN, displayName: "Ben" },
        ])
        agents.activeInOrder.mockResolvedValue([{ id: BOT, name: "Bot", module: "sales" }])
        await expect(
            access.allKnown(WS, [
                { memberKind: "user", memberId: ANA },
                { memberKind: "agent", memberId: BOT },
                { memberKind: "agent", memberId: BOT },
            ]),
        ).resolves.toBe(true)
        expect(agents.activeInOrder).toHaveBeenCalledWith(WS, [BOT, BOT], 2)
    })

    it("refuses a person with no active seat and an agent that is not active", async () => {
        const { access, seats, agents } = await build()
        seats.activeUsers.mockResolvedValue([{ userId: ANA, displayName: "Ana" }])
        agents.activeInOrder.mockResolvedValue([])
        await expect(access.allKnown(WS, [{ memberKind: "user", memberId: BEN }])).resolves.toBe(false)
        await expect(access.allKnown(WS, [{ memberKind: "agent", memberId: BOT }])).resolves.toBe(false)
    })

    it("reads no seats when no person is named, and knows an empty list", async () => {
        const { access, seats, agents } = await build()
        agents.activeInOrder.mockResolvedValue([])
        await expect(access.allKnown(WS, [])).resolves.toBe(true)
        expect(seats.activeUsers).not.toHaveBeenCalled()
    })
})
