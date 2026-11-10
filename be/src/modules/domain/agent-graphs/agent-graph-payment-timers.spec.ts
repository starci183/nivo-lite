import { TOOL } from "@nivo-lite/blocks-core"
import { ORDER_ROW, flowWorldOf } from "@tests/fixtures/builders/flow-f-world.builder"
import type { FlowWake } from "./policies/graph-flow.policy"
import { driveRouted, routedWorkflowsOf } from "@tests/fixtures/builders/flow-routed-world.builder"

/** The wake of a care timer of the order of the scenarios, as the minute sweep tags it. */
const timer = (careKind: string): FlowWake => ({
    source: "tag",
    actorMemberId: null,
    context: {
        text: "care.due",
        tagSource: "care",
        subject: "order:order-1",
        tagContext: JSON.stringify({
            event: "care.due",
            careKind,
            ref: "order-1",
            suffix: "",
            dueAt: "2026-11-04T10:00:00.000Z",
        }),
    },
})

/** The store of a shop whose order of the timer stands at `status`, with its customer. */
const worldWith = (status: string) =>
    flowWorldOf({
        order: [{ ...ORDER_ROW, status, shippedAt: null }],
        "sales-lead": [{ id: "lead-1", contactName: "An" }],
    })

/** What a run said to anyone: a line to the customer, or a line or card to the team. */
const spoken = (world: ReturnType<typeof flowWorldOf>) =>
    world.ran.filter((each) => each.effect === TOOL.customerMessageSend || each.effect === TOOL.teamMessagePost)

describe("the payment timers of an order the customer already paid or that was cancelled", () => {
    it.each([
        ["payment-reminder", "paid"],
        ["payment-stale", "paid"],
        ["payment-reminder", "cancelled"],
        ["payment-stale", "cancelled"],
    ])("a late %s timer of a %s order does nothing and says nothing: no model call, no customer line, no team card", async (careKind, status) => {
        const world = worldWith(status)

        const run = await driveRouted(world, routedWorkflowsOf(), "sales", {}, timer(careKind))

        expect(run.workflow).toBe("payment-reminder")
        expect(run.failed).toBeNull()
        expect(spoken(world)).toEqual([])
        expect(Object.values(run.outputs).some((output) => JSON.stringify(output).includes('"settled"'))).toBe(true)
    })
})
