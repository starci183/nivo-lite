import { Test } from "@nestjs/testing"
import { audienceOfModule, viewOf, knowledgeFolderOf, clip, withinBudget } from "./knowledge-view.policy"

const SUBJECT = Symbol("knowledge-view.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { audienceOfModule, viewOf, knowledgeFolderOf, clip, withinBudget } },
        ],
    }).compile()
    return moduleRef.get<typeof import("./knowledge-view.policy")>(SUBJECT)
}

describe("knowledge view policy", () => {
    it("restricts customer, publishing and unknown modules to public knowledge", async () => {
        const subject = await build()

        expect(subject.audienceOfModule("chatbot")).toBe("customer")
        expect(subject.audienceOfModule("content")).toBe("customer")
        expect(subject.audienceOfModule("video")).toBe("customer")
        expect(subject.audienceOfModule("unknown")).toBe("customer")
        expect(subject.audienceOfModule("accounting")).toBe("internal")
    })

    it("keeps the module's audience when no narrower audience is requested", async () => {
        const subject = await build()

        expect(subject.viewOf({ workspaceId: "ws-1", module: "accounting" })).toEqual({
            workspaceId: "ws-1",
            module: "accounting",
            audience: "internal",
            installationId: null,
        })
        expect(subject.viewOf({ workspaceId: "ws-1", module: "chatbot", audience: "internal" })).toEqual({
            workspaceId: "ws-1",
            module: "chatbot",
            audience: "customer",
            installationId: null,
        })
    })

    it("allows a caller to narrow an internal view and retains its installation", async () => {
        const subject = await build()

        expect(
            subject.viewOf({
                workspaceId: "ws-1",
                module: "accounting",
                audience: "customer",
                installationId: "agent-1",
            }),
        ).toEqual({
            workspaceId: "ws-1",
            module: "accounting",
            audience: "customer",
            installationId: "agent-1",
        })
        expect(
            subject.viewOf({ workspaceId: "ws-1", module: "accounting", audience: "internal", installationId: null }),
        ).toEqual({ workspaceId: "ws-1", module: "accounting", audience: "internal", installationId: null })
    })

    it("looks up known knowledge folders and answers null for unknown modules", async () => {
        const subject = await build()

        expect(subject.knowledgeFolderOf("chatbot")).toBe("chatbot")
        expect(subject.knowledgeFolderOf("accounting")).toBe("accounting")
        expect(subject.knowledgeFolderOf("unknown")).toBeNull()
    })

    it("preserves fitting text and clips long text with a trimmed ellipsis", async () => {
        const subject = await build()

        expect(subject.clip("Tea", 3)).toBe("Tea")
        expect(subject.clip("Tea", 4)).toBe("Tea")
        expect(subject.clip("Tea   menu", 6)).toBe("Tea…")
        expect(subject.clip("Tea", 1)).toBe("…")
    })

    it("takes fitting lines in order and stops before the first oversized line", async () => {
        const subject = await build()

        expect(subject.withinBudget(["Tea", "Milk", "x"], 7)).toEqual(["Tea", "Milk"])
        expect(subject.withinBudget(["too long", "x"], 1)).toEqual([])
        expect(subject.withinBudget([], 0)).toEqual([])
    })
})

describe("knowledge view policy for Sales", () => {
    it("reads the team's knowledge in the Office and public knowledge only when it answers a customer on a channel", async () => {
        const subject = await build()

        expect(subject.viewOf({ workspaceId: "ws-1", module: "sales" }).audience).toBe("internal")
        expect(subject.viewOf({ workspaceId: "ws-1", module: "sales", audience: "customer" }).audience).toBe("customer")
    })
})
