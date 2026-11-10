import { mock } from "@starci/jest-preset"
import type { TeamChatAudienceService } from "@modules/domain/team-chat"
import type { Logger } from "@modules/platform/logging"
import { SetChatRoomPurposeCommand } from "./set-chat-room-purpose.command"
import { SetChatRoomPurposeHandler } from "./set-chat-room-purpose.handler"

const commandOf = (purpose: { purpose: "group" | "common" } | { purpose: "module"; module: string }) =>
    new SetChatRoomPurposeCommand({
        request: { workspaceId: "ws-1", roomId: "room-1", purpose },
        principal: { id: "user-1" } as never,
    })

describe("SetChatRoomPurposeHandler", () => {
    it("hands the viewer, the room and the purpose to the audience service and returns its answer", async () => {
        const answer = { ok: true, value: { id: "room-1" } }
        const audience = mock<TeamChatAudienceService>({ setRoomPurpose: jest.fn().mockResolvedValue(answer) })
        const handler = new SetChatRoomPurposeHandler(mock<Logger>(), audience)

        await expect(handler.execute(commandOf({ purpose: "module", module: "sales" }))).resolves.toBe(answer)
        expect(audience.setRoomPurpose).toHaveBeenCalledWith("ws-1", "user-1", "room-1", {
            purpose: "module",
            module: "sales",
        })
    })

    it("returns the refusal of the domain untouched, deciding nothing itself", async () => {
        const refusal = { ok: false, refusal: "TEAM_CHAT_PURPOSE_TAKEN" }
        const audience = mock<TeamChatAudienceService>({ setRoomPurpose: jest.fn().mockResolvedValue(refusal) })
        const handler = new SetChatRoomPurposeHandler(mock<Logger>(), audience)

        await expect(handler.execute(commandOf({ purpose: "common" }))).resolves.toBe(refusal)
    })
})
