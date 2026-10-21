import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OfficeCardsService, OfficeLinesService } from "@modules/domain/messages"
import type { WorkContext } from "@modules/domain/decisions"
import { EditorRoomService } from "./editor-room.service"
import type { EditorCard } from "./editor-delegation.contracts"

const CTX: WorkContext = { workspaceId: "workspace-1", actor: "AI Editor", locale: "vi" }
const CARD: EditorCard = { v: 1, type: "video_ready", title: "Video" }

const build = async () => {
    const lines = mock<OfficeLinesService>()
    const cards = mock<OfficeCardsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            EditorRoomService,
            { provide: OfficeLinesService, useValue: lines },
            { provide: OfficeCardsService, useValue: cards },
        ],
    }).compile()
    return { room: moduleRef.get(EditorRoomService), lines, cards }
}

describe("EditorRoomService", () => {
    it("posts a card in the Marketing room spoken by the video agent, linked to its work item", async () => {
        const { room, cards } = await build()
        cards.postAsDepartment.mockResolvedValue({ id: "message-1", room: "marketing" })

        await expect(room.post(CTX, "Video ready", CARD, "item-1")).resolves.toBe("message-1")

        expect(cards.postAsDepartment).toHaveBeenCalledWith({ workspaceId: "workspace-1" }, "video", {
            room: "marketing",
            body: "Video ready",
            leadId: null,
            workItemId: "item-1",
            card: CARD,
        })
    })

    it("says a plain line", async () => {
        const { room, lines } = await build()

        await room.say(CTX, "Render failed", "item-1")

        expect(lines.post).toHaveBeenCalledWith(CTX, {
            body: "Render failed",
            lead_id: null,
            work_item_id: "item-1",
            dept: "video",
        })
    })
})
