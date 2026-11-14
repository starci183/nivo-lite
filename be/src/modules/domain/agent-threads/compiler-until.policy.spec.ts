import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { TEMPLATE_UNTIL_STEP } from "@modules/domain/installed-plugins"
import { THREAD_END } from "@modules/integrations/langgraph"
import { untilStepBudgetOf, untilTargetsOf, withUntilLoops } from "./compiler-until.policy"
import { FREEZE_NODE, compileTemplate } from "./template-compiler.policy"

const node = (key: string, more: Partial<GraphSpecNode> = {}): GraphSpecNode => ({ key, kind: "execute", step: "spec.step", ...more })

const UNTIL = { op: "gte", ref: { $ref: "steps.count.output.n", default: null }, value: 3 }

const SPEC: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "spec",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [], effects: [] },
    nodes: [
        node("poll", {
            step: TEMPLATE_UNTIL_STEP,
            params: { mode: "until", until: UNTIL, max: 4 } as never,
            routes: { body: "note", exhausted: "gaveup" },
            next: "done",
        }),
        node("note", { next: "count" }),
        node("count", { kind: "condition", routes: { again: "note" } }),
        node("done"),
        node("gaveup", { step: "stop" }),
    ],
}

const compiled = () => {
    const result = compileTemplate(
        { pin: { versionId: "v", workflowId: null, number: 1, documentHash: null, templateId: null, templateVersion: null }, spec: SPEC },
        new Set(["spec.step", TEMPLATE_UNTIL_STEP]),
        { loops: true },
    )
    if (result.kind !== "compiled") throw new Error(JSON.stringify(result.problems))
    return withUntilLoops(result.graph, SPEC)
}

describe("withUntilLoops", () => {
    it("draws the until loop as a cycle: the loop node goes to its body, `exhausted` or `next`; every way out of the body goes back", () => {
        const steps = new Map(compiled().nodes.map((step) => [step.key, step]))
        expect(steps.get("poll")).toMatchObject({ exit: { kind: "next", to: "done" }, ends: ["note", THREAD_END, "done", FREEZE_NODE] })
        expect(steps.get("note")).toMatchObject({ inLoop: "poll", exit: { kind: "next", to: "count" } })
        expect(steps.get("count")).toMatchObject({
            inLoop: "poll",
            exit: { kind: "branch", routes: { again: "note" }, otherwise: "poll" },
            ends: ["note", "poll", FREEZE_NODE],
        })
        expect(steps.get("done")?.inLoop).toBeUndefined()
        expect(untilTargetsOf(SPEC, SPEC.nodes[0] as GraphSpecNode)).toEqual({ body: "note", exhausted: THREAD_END, next: "done" })
    })

    it("sizes one drive for every round of the loop, so the recursion limit never stops a legal loop", () => {
        // 5 nodes + the gate + 4 rounds of (2 body nodes + the loop node's visit).
        expect(untilStepBudgetOf(SPEC)).toBe(5 + 1 + 4 * 3)
    })
})
