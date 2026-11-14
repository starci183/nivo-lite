import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { TEMPLATE_UNTIL_STEP } from "@modules/domain/installed-plugins"
import { THREAD_END } from "@modules/integrations/langgraph"
import { untilCompileProblemsOf, untilStepBudgetOf, untilTargetsOf, withUntilLoops } from "./compiler-until.policy"
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

    // R68 + R75 (E-FIX7): "a step's declared end outcome is a route of that step wherever the step sits: top level, loop body; leaving a
    // loop this way clears the loop frame". G-SLIM's `paid-order` (pay until-loop body, `unsuccessful: { then: "end", outcome: "declined" }`)
    // failed `LANGGRAPH_ROUTE_UNDECLARED {node: paid-order, goto: declined}`: the until compile rebuilt a body step's `ends` from its round
    // exit only and dropped the outcome the template compiler had put there.
    describe("a declared end outcome is a route of its step wherever the step sits (R68, R75)", () => {
        const ENDS_AT_DECLINED = { unsuccessful: { then: "end" as const, outcome: "declined", facts: [] } }
        const DECLINED = node("declined")
        const until = (spec: GraphSpec): ReturnType<typeof withUntilLoops> => {
            const result = compileTemplate(
                { pin: { versionId: "v", workflowId: null, number: 1, documentHash: null, templateId: null, templateVersion: null }, spec },
                new Set(["spec.step", TEMPLATE_UNTIL_STEP, "core.for-each"]),
                { loops: true },
            )
            if (result.kind !== "compiled") throw new Error(JSON.stringify(result.problems))
            return withUntilLoops(result.graph, spec)
        }
        const stepOf = (spec: GraphSpec, key: string) => until(spec).nodes.find((step) => step.key === key)

        it("top level: the outcome is one of the step's ends beside its own exit", () => {
            const spec: GraphSpec = { ...SPEC, nodes: [node("pay", { next: "done", ...ENDS_AT_DECLINED }), node("done"), DECLINED] }
            expect(stepOf(spec, "pay")).toMatchObject({ exit: { kind: "next", to: "done" }, ends: ["done", "declined", FREEZE_NODE] })
        })

        it("inside an until loop's body: the outcome stays a route of the body step (it leaves the round), the round's end still goes back", () => {
            const spec: GraphSpec = {
                ...SPEC,
                nodes: [
                    ...SPEC.nodes.slice(0, 1),
                    node("note", { next: "count", ...ENDS_AT_DECLINED }),
                    ...SPEC.nodes.slice(2),
                    DECLINED,
                ],
            }
            const note = stepOf(spec, "note")
            expect(note).toMatchObject({ inLoop: "poll", exit: { kind: "next", to: "count" }, ends: ["count", "declined", FREEZE_NODE] })
            // A body step that declares `continue` (or nothing) gains no way out of the round.
            const going = { ...spec, nodes: spec.nodes.map((one) => (one.key === "note" ? node("note", { next: "count", unsuccessful: { then: "continue" as const, facts: [] } }) : one)) }
            expect(stepOf(going, "note")?.ends).toEqual(["count", FREEZE_NODE])
        })

        it("inside a sequential for-each body: the outcome is a route of the body step beside the way back to the loop node", () => {
            const spec: GraphSpec = {
                ...SPEC,
                nodes: [
                    node("each", { step: "core.for-each", routes: { body: "price" }, next: "after" }),
                    node("price", { next: "note", ...ENDS_AT_DECLINED }),
                    node("note"),
                    node("after"),
                    DECLINED,
                ],
            }
            expect(stepOf(spec, "price")).toMatchObject({ inLoop: "each", ends: ["note", "declined", FREEZE_NODE] })
        })

        // A NESTED loop (a loop in an until body, an until in any loop body, a for-each in a for-each) is refused for a thread
        // (`GRAPH_LOOP_NESTED` / `TEMPLATE_LOOP_NESTED`: one frame per thread), and `end` in a fan-out body is refused at save by the SDK
        // (`GRAPH_UNSUCCESSFUL_END_IN_FANOUT`, run by the engine's save through `templateGraphProblems`): neither can carry this route.
        it("a loop nested in an until body is refused, so no nested frame can be left this way", () => {
            const spec: GraphSpec = {
                ...SPEC,
                nodes: [
                    ...SPEC.nodes.slice(0, 1),
                    node("note", { step: "core.for-each", routes: { body: "inner" }, next: "count" }),
                    node("inner", ENDS_AT_DECLINED),
                    ...SPEC.nodes.slice(2),
                    DECLINED,
                ],
            }
            expect(untilCompileProblemsOf(spec).map((problem) => problem.code)).toContain("GRAPH_LOOP_NESTED")
        })
    })

    it("sizes one drive for every round of the loop, so the recursion limit never stops a legal loop", () => {
        // 5 nodes + the gate + 4 rounds of (2 body nodes + the loop node's visit).
        expect(untilStepBudgetOf(SPEC)).toBe(5 + 1 + 4 * 3)
    })
})
