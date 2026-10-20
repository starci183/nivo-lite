import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OfficeLinesService } from "@modules/domain/messages"
import type { WorkContext } from "@modules/domain/decisions"
import { EditorRoomService } from "./editor-room.service"
import type { EditorCard } from "./editor-delegation.contracts"

const CTX: WorkContext = { workspaceId: "workspace-1", actor: "AI Editor", locale: "vi" }
const CARD: EditorCard = { v: 1, type: "video_ready", title: "Video" }

const build = async () => {
    const lines = mock<OfficeLinesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [EditorRoomService, { provide: OfficeLinesService, useValue: lines }],
    }).compile()
    return { room: moduleRef.get(EditorRoomService), lines }
}

describe("EditorRoomService", () => {
    it("posts a card as its preview line spoken by the video agent, with its link when it has one", async () => {
        const { room, lines } = await build()

        await room.post(CTX, "Video ready", CARD, "item-1")
        await room.post(CTX, "Video ready", { ...CARD, link: { label: "Open", href: "/agents/video" } }, "item-2")

        expect(lines.post.mock.calls).toEqual([
            [CTX, { body: "Video ready", lead_id: null, work_item_id: "item-1", dept: "video" }],
            [CTX, { body: "Video ready (/agents/video)", lead_id: null, work_item_id: "item-2", dept: "video" }],
        ])
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
