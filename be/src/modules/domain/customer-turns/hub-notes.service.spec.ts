import { mockEntityManager } from "@starci/jest-preset"
import type { HubNote } from "./gateway-turns.contracts"
import { HubNotesService, noteBodyOf } from "./hub-notes.service"
import { INSERT_HUB_LINE } from "./persistence/gateway-turns.sql"

const NOTE: HubNote = {
    workspaceId: "ws",
    room: "sales",
    type: "booking_held",
    title: "Đã giữ chỗ",
    fields: [{ label: "Khách", value: "Lan" }],
    authorName: "AI Sales",
}

describe("HubNotesService", () => {
    it("posts the note's one-line body as the agent", async () => {
        const entityManager = mockEntityManager()
        entityManager.query.mockResolvedValue([{ id: "m1" }])
        await new HubNotesService(entityManager).post(NOTE, "agent-1", { leadId: "l1", workItemId: null })
        expect(entityManager.query).toHaveBeenCalledWith(INSERT_HUB_LINE, [
            "ws",
            "agent-1",
            "Đã giữ chỗ · Khách: Lan",
            "l1",
            null,
        ])
        expect(noteBodyOf({ ...NOTE, fields: [] })).toBe("Đã giữ chỗ")
    })
})
