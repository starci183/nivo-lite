import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import {
    localContractProblems,
    newKeyOf,
    withBinding,
    withCallTarget,
    withSource,
    withStepAfter,
} from "./workflowEdits"

const SPEC: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    contract: { inputs: [{ name: "conversationId", type: "string", required: true }] },
    triggers: [{ key: "zalo", source: { kind: "zalo", connectionId: null } }],
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [
        { key: "reply", kind: "output", step: "core.reply", next: "end" },
        { key: "end", kind: "output", step: "stop" },
    ],
}

describe("the structural edits of the step drawer", () => {
    it("inserts a new step after another, taking its next, and first after the trigger", () => {
        const after = withStepAfter(SPEC, "reply", "core.if")
        expect(after.key).toBe("if")
        expect(after.spec.nodes.map((node) => [node.key, node.next])).toEqual([
            ["reply", "if"],
            ["if", "end"],
            ["end", undefined],
        ])
        expect(after.spec.nodes[1]?.kind).toBe("condition")
        const first = withStepAfter(SPEC, "trigger", "core.reply")
        expect(first.key).toBe("reply-2")
        expect(first.spec.nodes[0]).toMatchObject({ key: "reply-2", next: "reply" })
    })

    it("gives a new hand-off a target and an empty mapping, and numbers a taken key", () => {
        const added = withStepAfter(SPEC, "reply", "core.call-workflow")
        expect(added.spec.nodes[1]?.params).toEqual({ agent: "sales", workflow: "consult", version: "latest", inputs: {} })
        expect(newKeyOf(SPEC, "core.reply")).toBe("reply-2")
    })

    it("binds a param to a ref or a fixed value, top-level or inside a hand-off's inputs", () => {
        const ref = withBinding(SPEC, "reply", "conversationId", { kind: "ref", ref: "trigger.conversationId" })
        expect(ref.nodes[0]?.params).toEqual({ conversationId: { $ref: "trigger.conversationId" } })
        const fixed = withBinding(ref, "reply", "text", { kind: "fixed", value: "Dạ" })
        expect(fixed.nodes[0]?.params?.text).toBe("Dạ")
        const call = withBinding(withStepAfter(SPEC, "reply", "core.call-workflow").spec, "call-workflow", "inputs.orderId", {
            kind: "fixed",
            value: "42",
        })
        expect(call.nodes[1]?.params?.inputs).toEqual({ orderId: 42 })
    })

    it("changes an input's source and keeps the wake envelope in step, and refuses an unknown source", () => {
        const sepay = withSource(SPEC, "zalo", "sepay")
        expect(sepay.triggers?.[0]?.source).toEqual({ kind: "sepay", connectionId: null })
        expect(sepay.trigger.sources).toEqual(["system-event"])
        expect(withSource(SPEC, "zalo", "fax")).toBe(SPEC)
    })

    it("retargets a hand-off at the latest version, keeping its mapping", () => {
        const added = withStepAfter(SPEC, "reply", "core.call-workflow").spec
        expect(withCallTarget(added, "call-workflow", "accounting.payment-claim").nodes[1]?.params).toEqual({
            agent: "accounting",
            workflow: "payment-claim",
            version: "latest",
            inputs: {},
        })
    })

    it("names the contract problems a source that cannot supply the inputs makes, and none for a missing graph", () => {
        expect(localContractProblems(SPEC)).toEqual([])
        expect(localContractProblems(withSource(SPEC, "zalo", "sepay")).map((problem) => problem.code)).toEqual([
            "TRIGGER_INPUT_UNSUPPLIED",
        ])
        expect(localContractProblems(null)).toEqual([])
        expect(localContractProblems(undefined)).toEqual([])
    })
})
