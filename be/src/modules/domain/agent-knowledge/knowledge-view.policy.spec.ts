import { Test } from "@nestjs/testing"
import { audienceOfModule, viewOf } from "./knowledge-view.policy"

const SUBJECT = Symbol("knowledge-view.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { audienceOfModule, viewOf } }],
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
        expect(subject.audienceOfModule("sales")).toBe("internal")
    })

    it("keeps the module's audience when no narrower audience is requested", async () => {
        const subject = await build()

        expect(subject.viewOf({ workspaceId: "ws-1", module: "sales" })).toEqual({
            workspaceId: "ws-1",
            module: "sales",
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
                module: "sales",
                audience: "customer",
                installationId: "agent-1",
            }),
        ).toEqual({
            workspaceId: "ws-1",
            module: "sales",
            audience: "customer",
            installationId: "agent-1",
        })
        expect(
            subject.viewOf({ workspaceId: "ws-1", module: "sales", audience: "internal", installationId: null }),
        ).toEqual({ workspaceId: "ws-1", module: "sales", audience: "internal", installationId: null })
    })
})

describe("knowledge view policy for Sales", () => {
    it("reads the team's knowledge in the Office and public knowledge only when it answers a customer on a channel", async () => {
        const subject = await build()

        expect(subject.viewOf({ workspaceId: "ws-1", module: "sales" }).audience).toBe("internal")
        expect(subject.viewOf({ workspaceId: "ws-1", module: "sales", audience: "customer" }).audience).toBe("customer")
    })
})
