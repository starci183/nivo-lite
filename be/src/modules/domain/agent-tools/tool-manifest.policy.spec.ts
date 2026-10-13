import { isBookingTool, isToolName, TOOL_MANIFEST } from "./tool-manifest.policy"

describe("tool manifest policy", () => {
    it("lists the four chat tools and the three booking tools", () => {
        expect(TOOL_MANIFEST.map((tool) => tool.name)).toEqual([
            "knowledge.search",
            "lead.create_or_update",
            "approval.request",
            "handoff.to_person",
            "booking.find_slots",
            "booking.request",
            "booking.cancel",
        ])
    })

    it("knows a manifest name and refuses any other text", () => {
        expect(isToolName("handoff.to_person")).toBe(true)
        expect(isToolName("shell.exec")).toBe(false)
    })

    it("recognises the booking tools only", () => {
        expect(isBookingTool("booking.request")).toBe(true)
        expect(isBookingTool("booking.find_slots")).toBe(true)
        expect(isBookingTool("booking.cancel")).toBe(true)
        expect(isBookingTool("knowledge.search")).toBe(false)
    })
})
