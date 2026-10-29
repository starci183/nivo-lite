import { LeadFlowEntity } from "./entities"
import { NOW, leadFlowOfRaw } from "./lead-flow-projection"

describe("lead flow projection", () => {
    it("names the database instant", () => {
        expect(NOW()).toBe("now()")
    })

    it("reads the first returned row from its column names", () => {
        const at = new Date("2026-10-12T10:00:00.000Z")
        const flow = leadFlowOfRaw([
            { id: "flow-1", workspace_id: "ws-1", resume_state: "scored", pending_question: 2, created_at: at },
            { id: "flow-2" },
        ])

        expect(flow).toBeInstanceOf(LeadFlowEntity)
        expect(flow).toMatchObject({
            id: "flow-1",
            workspaceId: "ws-1",
            resumeState: "scored",
            pendingQuestion: 2,
            createdAt: at,
        })
    })

    it.each([[[]], [undefined], [[null]], [["text"]]])("answers nothing for the raw result %j", (raw) => {
        expect(leadFlowOfRaw(raw)).toBeUndefined()
    })
})
