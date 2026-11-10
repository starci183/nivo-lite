import { mock } from "@starci/jest-preset"
import type { TeamChatAudienceService } from "@modules/domain/team-chat"
import type { Logger } from "@modules/platform/logging"
import { SetChatRoomPostRightCommand } from "./set-chat-room-post-right.command"
import { SetChatRoomPostRightHandler } from "./set-chat-room-post-right.handler"

const commandOf = (mayPost: boolean) =>
    new SetChatRoomPostRightCommand({
        request: { workspaceId: "ws-1", roomId: "room-1", agentId: "agent-1", mayPost },
        principal: { id: "user-1" } as never,
    })

describe("SetChatRoomPostRightHandler", () => {
    it("hands the viewer, the room, the agent and the right to the audience service and returns its answer", async () => {
        const answer = { ok: true, value: { id: "room-1" } }
        const audience = mock<TeamChatAudienceService>({ setPostRight: jest.fn().mockResolvedValue(answer) })
        const handler = new SetChatRoomPostRightHandler(mock<Logger>(), audience)

        await expect(handler.execute(commandOf(true))).resolves.toBe(answer)
        expect(audience.setPostRight).toHaveBeenCalledWith("ws-1", "user-1", "room-1", "agent-1", true)
    })

    it("returns the refusal of the domain untouched, deciding nothing itself", async () => {
        const refusal = { ok: false, refusal: "TEAM_CHAT_POST_RIGHT_NEEDS_SEAT" }
        const audience = mock<TeamChatAudienceService>({ setPostRight: jest.fn().mockResolvedValue(refusal) })
        const handler = new SetChatRoomPostRightHandler(mock<Logger>(), audience)

        await expect(handler.execute(commandOf(false))).resolves.toBe(refusal)
        expect(audience.setPostRight).toHaveBeenCalledWith("ws-1", "user-1", "room-1", "agent-1", false)
    })
})
