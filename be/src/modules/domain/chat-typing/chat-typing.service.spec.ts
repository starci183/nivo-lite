import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import type { ChatRoomView } from "@modules/domain/team-chat"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { ChatTypingErrorCode } from "./errors/chat-typing.error"
import { ChatTypingService } from "./chat-typing.service"

const NOW = "2026-10-25T03:00:00.000Z"
const ROOM = "room-1"

/** A member of a room as its view lists it. */
type RoomMember = ChatRoomView["members"][number]

const memberOf = (memberId: string, name: string, memberKind: "user" | "agent" = "user"): RoomMember => ({
    memberKind,
    memberId,
    name,
    role: "member",
    lastReadAt: new Date(NOW),
    muted: false,
})

const roomOf = (members: ReadonlyArray<RoomMember>): ChatRoomView => ({
    id: ROOM,
    kind: "group",
    name: "Sales",
    position: 0,
    createdBy: "user-1",
    createdAt: new Date(NOW),
    members,
    unreadCount: 0,
    mentionCount: 0,
    muted: false,
    lastMessage: null,
})

const SITTING = [
    memberOf("user-1", "Mai Linh"),
    memberOf("user-2", "An"),
    memberOf("user-3", "Binh"),
    memberOf("agent-1", "Ke toan", "agent"),
]

const build = async () => {
    const chat = mock<TeamChatRoomsService>({ room: jest.fn().mockResolvedValue(roomOf(SITTING)) })
    const seats = mock<WorkspaceMemberSeatsService>({
        activeUsers: jest.fn().mockResolvedValue([
            { userId: "user-1", displayName: "Mai Linh" },
            { userId: "user-2", displayName: "An" },
        ]),
    })
    const realtime = mock<RealtimeHub>({ publish: jest.fn().mockResolvedValue(undefined) })
    const clock = new FakeClock(NOW)
    const now = jest.spyOn(clock, "now")
    const container = await Test.createTestingModule({
        providers: [
            ChatTypingService,
            { provide: TeamChatRoomsService, useValue: chat },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: REALTIME_HUB, useValue: realtime },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { service: container.get(ChatTypingService), chat, seats, realtime, now }
}

describe("ChatTypingService.set", () => {
    it("authors the seated person's identity and gives a start signal a five-second deadline", async () => {
        const { service, chat, realtime } = await build()
        const signal = {
            id: "user-1",
            name: "Mai Linh",
            avatarSeed: "user-1",
            typing: true,
            expiresAt: "2026-10-25T03:00:05.000Z",
        }

        await expect(service.set("user-1", "workspace-1", ROOM, true)).resolves.toEqual(signal)
        expect(chat.room).toHaveBeenCalledWith("workspace-1", "user-1", ROOM)
        const frame = { id: `user-1:${NOW}`, actorId: "user-1", actorName: "Mai Linh", state: "start", at: NOW }
        expect(realtime.publish).toHaveBeenCalledTimes(2)
        expect(realtime.publish).toHaveBeenCalledWith(
            expect.objectContaining({ name: "chat-typing:user-2:workspace-1:room:room-1" }),
            frame,
        )
        expect(realtime.publish).toHaveBeenCalledWith(
            expect.objectContaining({ name: "chat-typing:user-3:workspace-1:room:room-1" }),
            frame,
        )
    })

    it("expires a stop signal immediately", async () => {
        const { service, realtime } = await build()
        const signal = { id: "user-1", name: "Mai Linh", avatarSeed: "user-1", typing: false, expiresAt: NOW }

        await expect(service.set("user-1", "workspace-1", ROOM, false)).resolves.toEqual(signal)
        expect(realtime.publish).toHaveBeenCalledWith(
            expect.objectContaining({ name: "chat-typing:user-2:workspace-1:room:room-1" }),
            { id: `user-1:${NOW}`, actorId: "user-1", actorName: "Mai Linh", state: "stop", at: NOW },
        )
    })

    it("fans out only to the other people of the room, never to the sender or to an agent", async () => {
        const { service, realtime } = await build()

        await service.set("user-1", "workspace-1", ROOM, true)

        const topics = realtime.publish.mock.calls.map(([topic]) => topic.name)
        expect(topics).toEqual([
            "chat-typing:user-2:workspace-1:room:room-1",
            "chat-typing:user-3:workspace-1:room:room-1",
        ])
    })

    it("refuses a room the caller cannot see, and a room the caller does not sit in, and publishes nothing", async () => {
        const { service, chat, realtime, now } = await build()
        chat.room.mockResolvedValueOnce(null).mockResolvedValueOnce(roomOf([memberOf("user-2", "An")]))

        await expect(service.set("user-1", "workspace-1", ROOM, true)).rejects.toMatchObject({
            code: ChatTypingErrorCode.RoomNotFound,
        })
        await expect(service.set("user-1", "workspace-1", ROOM, true)).rejects.toMatchObject({
            code: ChatTypingErrorCode.RoomNotFound,
        })
        expect(realtime.publish).not.toHaveBeenCalled()
        expect(now).not.toHaveBeenCalled()
    })

    it("propagates a failed publish instead of acknowledging an unsent signal", async () => {
        const { service, realtime } = await build()
        const failure = new Error("realtime unavailable")
        realtime.publish.mockRejectedValue(failure)

        await expect(service.set("user-1", "workspace-1", ROOM, true)).rejects.toBe(failure)
    })
})

describe("ChatTypingService.setAgent", () => {
    const AGENT = { id: "agent-1", name: "Ke toan" }

    it("tells every active account of the workspace that the agent is working, with no caller to prove", async () => {
        const { service, chat, seats, realtime } = await build()

        await service.setAgent("workspace-1", ROOM, AGENT, true)

        const frame = { id: `agent-1:${NOW}`, actorId: "agent-1", actorName: "Ke toan", state: "start", at: NOW }
        expect(seats.activeUsers).toHaveBeenCalledWith("workspace-1", 500)
        expect(chat.room).not.toHaveBeenCalled()
        expect(realtime.publish).toHaveBeenCalledTimes(2)
        expect(realtime.publish).toHaveBeenCalledWith(
            expect.objectContaining({ name: "chat-typing:user-1:workspace-1:room:room-1" }),
            frame,
        )
        expect(realtime.publish).toHaveBeenCalledWith(
            expect.objectContaining({ name: "chat-typing:user-2:workspace-1:room:room-1" }),
            frame,
        )
    })

    it("clears the indicator when the turn ends", async () => {
        const { service, realtime } = await build()

        await service.setAgent("workspace-1", ROOM, AGENT, false)

        expect(realtime.publish).toHaveBeenCalledWith(
            expect.objectContaining({ name: "chat-typing:user-1:workspace-1:room:room-1" }),
            { id: `agent-1:${NOW}`, actorId: "agent-1", actorName: "Ke toan", state: "stop", at: NOW },
        )
    })

    it("propagates a failed publish", async () => {
        const { service, realtime } = await build()
        const failure = new Error("realtime unavailable")
        realtime.publish.mockRejectedValue(failure)

        await expect(service.setAgent("workspace-1", ROOM, AGENT, true)).rejects.toBe(failure)
    })
})
