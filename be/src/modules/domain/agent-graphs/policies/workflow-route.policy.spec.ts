import { Test } from "@nestjs/testing"
import type { RoutableWorkflow } from "../agent-workflows.contracts"
import { workflowRouteOf } from "./workflow-route.policy"

const SUBJECT = Symbol("workflow-route.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { workflowRouteOf } }],
    }).compile()
    return moduleRef.get<{ workflowRouteOf: typeof workflowRouteOf }>(SUBJECT)
}

const ALL = ["channel", "chats-group", "agent", "system-event", "schedule"]

const workflow = (id: string, extra: Partial<RoutableWorkflow> = {}): RoutableWorkflow => ({
    id,
    status: "active",
    primary: false,
    position: 0,
    sources: ALL,
    ...extra,
})

describe("workflowRouteOf", () => {
    it("sends a wake to the primary workflow when it is the only one that takes the source", async () => {
        const subject = await build()

        expect(subject.workflowRouteOf([workflow("main", { primary: true })], "channel")).toBe("main")
    })

    it("lets the narrowest active workflow take a source before the primary one", async () => {
        const subject = await build()
        const workflows = [
            workflow("main", { primary: true }),
            workflow("reports", { sources: ["schedule"], position: 1 }),
        ]

        expect(subject.workflowRouteOf(workflows, "schedule")).toBe("reports")
        expect(subject.workflowRouteOf(workflows, "channel")).toBe("main")
    })

    it("never routes to a draft or paused workflow", async () => {
        const subject = await build()
        const workflows = [
            workflow("main", { primary: true }),
            workflow("reports", { sources: ["schedule"], status: "draft" }),
            workflow("nudges", { sources: ["schedule"], status: "paused" }),
        ]

        expect(subject.workflowRouteOf(workflows, "schedule")).toBe("main")
    })

    it("breaks a tie by the primary flag, then by the place in the list", async () => {
        const subject = await build()

        expect(subject.workflowRouteOf([workflow("b", { position: 2 }), workflow("a", { position: 1 })], "agent")).toBe(
            "a",
        )
        expect(
            subject.workflowRouteOf([workflow("b"), workflow("main", { primary: true, position: 5 })], "agent"),
        ).toBe("main")
    })

    it("answers null when no active workflow takes the source", async () => {
        const subject = await build()

        expect(subject.workflowRouteOf([workflow("reports", { sources: ["schedule"] })], "channel")).toBeNull()
        expect(subject.workflowRouteOf([], "channel")).toBeNull()
    })
})
