import { Test } from "@nestjs/testing"
import {
    outputSpecOf,
    approvalSpecOf,
    approvedInputOf,
    approvedOutputsOf,
    declinedReplyOf,
    finalReplySpecOf,
    outputResultOf,
    outputStepFrom,
    outputsOf,
    finalReplyOwed,
} from "./output-steps.policy"
import type { OutputScope } from "./output-steps.schema"

const POLICY = Symbol("output-steps.policy.ts")
type PolicyFunctions = Pick<
    typeof import("./output-steps.policy"),
    | "outputSpecOf"
    | "approvalSpecOf"
    | "approvedInputOf"
    | "approvedOutputsOf"
    | "declinedReplyOf"
    | "finalReplySpecOf"
    | "outputResultOf"
    | "outputStepFrom"
    | "outputsOf"
    | "finalReplyOwed"
>
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: POLICY,
                useValue: {
                    outputSpecOf,
                    approvalSpecOf,
                    approvedInputOf,
                    approvedOutputsOf,
                    declinedReplyOf,
                    finalReplySpecOf,
                    outputResultOf,
                    outputStepFrom,
                    outputsOf,
                    finalReplyOwed,
                },
            },
        ],
    }).compile()
    return moduleRef.get<PolicyFunctions>(POLICY)
}

const SCOPE: OutputScope = {
    conversationId: "c1",
    messageId: "m1",
    approvedBy: null,
    workItemId: null,
    planned: "",
    declined: false,
    outputNode: "act:gateway_call",
    approvalNode: "ask:gateway_call",
    replyNode: "act:reply_customer",
}
const OK = outputResultOf({ tool: "orders.draft", status: "ok", code: null, summary: "ORD-1" }, SCOPE)
const HELD = outputResultOf({ tool: "orders.draft", status: "held", code: "ask_mode", summary: "" }, SCOPE)
const INPUT = {
    workItemId: "w1",
    deadlineAt: "2026-11-04T00:00:00.000Z",
    calls: [
        { tool: "a.b", argsJson: "{}" },
        { tool: "c.d", argsJson: "{}" },
    ],
    scope: SCOPE,
}

describe("outputSpecOf", () => {
    it("draws the step on the output node as a write that cannot be undone", async () => {
        const subject = await build()

        const spec = subject.outputSpecOf(
            { stepKey: "output:a:1", tool: "a", argsJson: "{}", opKey: "m1:a" },
            [],
            SCOPE,
        )
        expect(spec).toMatchObject({ nodeKey: "act:gateway_call", kind: "output", effect: { kind: "pivot" } })
    })
})

describe("finalReplyOwed", () => {
    it("owes a reply once an output came to something, on the reply node", async () => {
        const subject = await build()

        expect(subject.finalReplyOwed({ "output:a:1": OK })).toMatchObject({
            stepKey: "final_reply",
            nodeKey: "act:reply_customer",
        })
    })

    it("owes nothing for a held call, a tool that does not exist or a run with no output", async () => {
        const subject = await build()

        const typo = subject.outputResultOf({ tool: "a", status: "failed", code: "unknown_tool", summary: "a" }, SCOPE)
        expect(subject.finalReplyOwed({ "output:a:1": HELD })).toBeNull()
        expect(subject.finalReplyOwed({ "output:a:1": typo })).toBeNull()
        expect(subject.finalReplyOwed({ understand: { any: true } })).toBeNull()
    })
})

describe("outputsOf", () => {
    it("reads only the outputs that came to something", async () => {
        const subject = await build()

        const steps = subject.outputsOf({ "output:a:1": OK, "output:a:2": HELD, door: {} }, null)
        expect(steps.map((step) => step.summary)).toEqual(["ORD-1"])
    })

    it("keeps distinct operations of the same tool, including an earlier failure", async () => {
        const subject = await build()

        const failed = subject.outputResultOf(
            { tool: "orders.draft", status: "failed", code: "tool_error", summary: "Order A failed" },
            SCOPE,
        )
        const steps = subject.outputsOf({ "output:a:1": failed, "output:a:2": OK }, null)
        expect(steps.map((step) => ({ status: step.status, summary: step.summary }))).toEqual([
            { status: "failed", summary: "Order A failed" },
            { status: "ok", summary: "ORD-1" },
        ])
    })

    it.each(["invalid_name", "unknown_tool"])(
        "keeps an approved call's %s failure so its final reply cannot say it completed",
        async (code) => {
            const subject = await build()

            const scope = { ...SCOPE, workItemId: "w1", approvedBy: "An" }
            const failed = { tool: "orders.draft", status: "failed", code, summary: "Tool unavailable", scope }
            const steps = subject.outputsOf({ "output:w1:0:orders.draft": failed }, "w1")
            expect(steps).toEqual([failed])
        },
    )
})

describe("a run that holds an output of its turn and an approved item", () => {
    const APPROVED = outputResultOf(
        { tool: "a.b", status: "ok", code: null, summary: "B" },
        { ...SCOPE, workItemId: "w1", approvedBy: "An" },
    )

    it("keeps each reply to its own output, under its own step key", async () => {
        const subject = await build()

        const earlier = { "output:a:1": OK, "output:w1:0:a.b": APPROVED }
        expect(subject.outputsOf(earlier, "w1").map((step) => step.summary)).toEqual(["B"])
        expect(subject.finalReplyOwed(earlier)?.stepKey).toBe("final_reply")
        expect(subject.finalReplySpecOf({ ...SCOPE, workItemId: "w1" }).stepKey).toBe("final_reply:w1")
    })
})

describe("approvalSpecOf", () => {
    it("waits at the approval node and changes nothing", async () => {
        const subject = await build()

        expect(subject.approvalSpecOf(INPUT)).toMatchObject({
            stepKey: "approval:w1",
            nodeKey: "ask:gateway_call",
            kind: "approval",
            effect: { kind: "read" },
        })
    })
})

describe("approvedOutputsOf", () => {
    it("runs the first call under the replay key of the item and carries the rest", async () => {
        const subject = await build()

        const [first] = subject.approvedOutputsOf(INPUT, "An")
        expect(first).toMatchObject({
            stepKey: "output:w1:0:a.b",
            input: {
                opKey: "w1:0:a.b",
                scope: { workItemId: "w1", approvedBy: "An" },
                rest: [{ stepKey: "output:w1:1:c.d", opKey: "w1:1:c.d" }],
            },
        })
    })

    it("keeps the replay key of a single call", async () => {
        const subject = await build()

        const [first] = subject.approvedOutputsOf({ ...INPUT, calls: [{ tool: "a.b", argsJson: "{}" }] }, "An")
        expect(first?.input.opKey).toBe("w1:a.b")
    })
})

describe("approvedInputOf persisted human edits", () => {
    it("preserves a legacy approval and refuses malformed or incomplete edited replay data", async () => {
        const subject = await build()
        expect(subject.approvedInputOf(INPUT, undefined)).toBe(INPUT)
        expect(subject.approvedInputOf(INPUT, {})).toBeNull()
        expect(subject.approvedInputOf(INPUT, { fields: {} })).toBeNull()
        expect(subject.approvedInputOf(INPUT, { fields: { tool: "a.b", args_json: "{}" } })).toBeNull()
        expect(subject.approvedInputOf(INPUT, { fields: {}, draft: null })).toBeNull()
        expect(subject.approvedInputOf(INPUT, { fields: { args_json: "not json" }, draft: null })).toBeNull()
        expect(subject.approvedInputOf(INPUT, { fields: { tool: "a.b", args_json: "[]" }, draft: null })).toBeNull()
        expect(subject.approvedInputOf(INPUT, { fields: { args_json: "{}" }, draft: null })).toBeNull()
        expect(subject.approvedInputOf(INPUT, { fields: { tool: "", args_json: "{}" }, draft: null })).toBeNull()
        expect(subject.approvedInputOf(INPUT, { fields: { steps_json: "[]" }, draft: null })).toBeNull()
    })

    it("replays the approved sequence with default empty arguments and no invented draft", async () => {
        const subject = await build()
        const edited = subject.approvedInputOf(INPUT, {
            fields: { steps_json: '[{"name":"a.b"},{"name":"c.d","arguments":{"qty":1}}]' },
            draft: null,
        })
        expect(edited).toEqual({
            ...INPUT,
            calls: [
                { tool: "a.b", argsJson: "{}" },
                { tool: "c.d", argsJson: '{"qty":1}' },
            ],
            scope: { ...SCOPE, planned: "" },
        })
    })

    it("replays an approved call's edited arguments and retains its draft", async () => {
        const subject = await build()
        const input = { ...INPUT, calls: [{ tool: "a.b", argsJson: "{}" }] }
        expect(
            subject.approvedInputOf(input, {
                fields: { tool: "a.b", args_json: '{"qty":1}' },
                draft: "Approved answer",
            }),
        ).toEqual({
            ...input,
            calls: [{ tool: "a.b", argsJson: '{"qty":1}' }],
            scope: { ...SCOPE, planned: "Approved answer" },
        })
    })
})

describe("output replay empty and refused rows", () => {
    it("owes no call for an empty approval and refuses an unread stored output", async () => {
        const subject = await build()
        expect(subject.approvedOutputsOf({ ...INPUT, calls: [] }, "member-1")).toEqual([])
        expect(subject.outputStepFrom({})).toBeNull()
        expect(subject.outputsOf({ "output:invalid": {} }, null)).toEqual([])
        const failed = subject.outputResultOf(
            { tool: "a.b", status: "failed", code: null, summary: "No result" },
            SCOPE,
        )
        expect(subject.outputsOf({ "output:failed": failed }, null)).toEqual([failed])
        expect(subject.outputsOf({ "output:other": OK }, "other-item")).toEqual([])
    })
})
