import { audienceOfModule, clip, knowledgeFolderOf, viewOf, withinBudget } from "./knowledge-view.policy"

describe("knowledge view policy", () => {
    it("restricts customer, publishing and unknown modules to public knowledge", () => {
        expect(audienceOfModule("chatbot")).toBe("customer")
        expect(audienceOfModule("content")).toBe("customer")
        expect(audienceOfModule("video")).toBe("customer")
        expect(audienceOfModule("unknown")).toBe("customer")
        expect(audienceOfModule("accounting")).toBe("internal")
    })

    it("keeps the module's audience when no narrower audience is requested", () => {
        expect(viewOf({ workspaceId: "ws-1", module: "accounting" })).toEqual({
            workspaceId: "ws-1",
            module: "accounting",
            audience: "internal",
            installationId: null,
        })
        expect(viewOf({ workspaceId: "ws-1", module: "chatbot", audience: "internal" })).toEqual({
            workspaceId: "ws-1",
            module: "chatbot",
            audience: "customer",
            installationId: null,
        })
    })

    it("allows a caller to narrow an internal view and retains its installation", () => {
        expect(
            viewOf({ workspaceId: "ws-1", module: "accounting", audience: "customer", installationId: "agent-1" }),
        ).toEqual({
            workspaceId: "ws-1",
            module: "accounting",
            audience: "customer",
            installationId: "agent-1",
        })
        expect(
            viewOf({ workspaceId: "ws-1", module: "accounting", audience: "internal", installationId: null }),
        ).toEqual({ workspaceId: "ws-1", module: "accounting", audience: "internal", installationId: null })
    })

    it("looks up known knowledge folders and answers null for unknown modules", () => {
        expect(knowledgeFolderOf("chatbot")).toBe("chatbot")
        expect(knowledgeFolderOf("accounting")).toBe("accounting")
        expect(knowledgeFolderOf("unknown")).toBeNull()
    })

    it("preserves fitting text and clips long text with a trimmed ellipsis", () => {
        expect(clip("Tea", 3)).toBe("Tea")
        expect(clip("Tea", 4)).toBe("Tea")
        expect(clip("Tea   menu", 6)).toBe("Tea…")
        expect(clip("Tea", 1)).toBe("…")
    })

    it("takes fitting lines in order and stops before the first oversized line", () => {
        expect(withinBudget(["Tea", "Milk", "x"], 7)).toEqual(["Tea", "Milk"])
        expect(withinBudget(["too long", "x"], 1)).toEqual([])
        expect(withinBudget([], 0)).toEqual([])
    })
})
