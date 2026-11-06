import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TeamChatService } from "@modules/domain/team-chat"
import type { WorkContext } from "@modules/domain/decisions"
import { EditorRoomService } from "./editor-room.service"
import type { EditorCard } from "./editor-delegation.contracts"

const CTX: WorkContext = { workspaceId: "workspace-1", actor: "AI Editor", locale: "vi" }
const CARD: EditorCard = { v: 1, type: "video_ready", title: "Video" }

const build = async () => {
    const chat = mock<TeamChatService>()
    chat.postAsAgent.mockResolvedValue({ roomId: "room-1", messageId: "message-1", agentId: "agent-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [EditorRoomService, { provide: TeamChatService, useValue: chat }],
    }).compile()
    return { room: moduleRef.get(EditorRoomService), chat }
}

describe("EditorRoomService", () => {
    it("says the preview of a card to the owner as the video agent and answers the id of the line", async () => {
        const { room, chat } = await build()

        await expect(room.post(CTX, "Video ready", CARD, "item-1")).resolves.toBe("message-1")

        expect(chat.postAsAgent).toHaveBeenCalledWith("workspace-1", {
            agent: "video",
            toUserId: null,
            body: "Video ready",
            key: null,
        })
    })

    it("answers no id when the workspace has no video agent", async () => {
        const { room, chat } = await build()
        chat.postAsAgent.mockResolvedValue(null)

        await expect(room.post(CTX, "Video ready", CARD, "item-1")).resolves.toBeNull()
    })

    it("says a plain line", async () => {
        const { room, chat } = await build()

        await room.say(CTX, "Render failed", "item-1")

        expect(chat.postAsAgent).toHaveBeenCalledWith("workspace-1", {
            agent: "video",
            toUserId: null,
            body: "Render failed",
            key: null,
        })
    })
})
