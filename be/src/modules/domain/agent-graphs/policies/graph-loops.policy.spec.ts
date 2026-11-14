import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { TEMPLATE_IF_STEP, TEMPLATE_UNTIL_STEP } from "@modules/domain/installed-plugins"
import { graphLoopProblemsOf, untilBodiesOf, untilSettingsOf } from "./graph-loops.policy"

const node = (key: string, more: Partial<GraphSpecNode> = {}): GraphSpecNode => ({
    key,
    kind: "execute",
    step: "spec.step",
    ...more,
})

const UNTIL = { op: "gte", ref: { $ref: "steps.count.output.n", default: null }, value: 3 }

const until = (
    params: Readonly<Record<string, unknown>> = {},
    routes: Readonly<Record<string, string>> = { body: "note", exhausted: "gaveup" },
) =>
    node("poll", {
        step: TEMPLATE_UNTIL_STEP,
        params: { mode: "until", until: UNTIL, max: 5, ...params } as never,
        routes,
        next: "done",
    })

const specOf = (nodes: ReadonlyArray<GraphSpecNode>): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "spec",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [], effects: [] },
    nodes: [...nodes],
})

const BODY = [node("note", { next: "count" }), node("count")]
const ENDS = [node("done"), node("gaveup")]

describe("graphLoopProblemsOf", () => {
    it("takes an until loop, its body and its round's way back to it", () => {
        const spec = specOf([until(), ...BODY, ...ENDS])
        expect(untilBodiesOf(spec).get("poll")).toEqual(new Set(["note", "count"]))
        expect(graphLoopProblemsOf(spec)).toEqual([])
        expect(
            graphLoopProblemsOf(
                specOf([until(), node("note", { next: "count" }), node("count", { next: "poll" }), ...ENDS]),
            ),
        ).toEqual([])
    })

    it("refuses any other cycle, with the nodes on it", () => {
        const spec = specOf([until(), ...BODY, node("done", { next: "poll" }), node("gaveup")])
        expect(
            graphLoopProblemsOf(spec)
                .filter((one) => one.code === "GRAPH_CYCLE")
                .map((one) => one.at),
        ).toEqual(["poll", "done"])
        expect(graphLoopProblemsOf(specOf([node("a", { next: "b" }), node("b", { next: "a" })]))).toEqual([
            { code: "GRAPH_CYCLE", at: "a" },
            { code: "GRAPH_CYCLE", at: "b" },
        ])
    })

    it("refuses a cap outside 1..10, a missing body or exhausted branch, a bad wait, a bad condition, a meaning node outside the body", () => {
        const codes = (spec: GraphSpec) => graphLoopProblemsOf(spec).map((one) => `${one.code} ${one.at}`)
        expect(codes(specOf([until({ max: 11 }), ...BODY, ...ENDS]))).toEqual(["GRAPH_LOOP_MAX poll"])
        expect(codes(specOf([until({ max: 0 }), ...BODY, ...ENDS]))).toEqual(["GRAPH_LOOP_MAX poll"])
        expect(codes(specOf([until({}, { body: "note" }), ...BODY, ...ENDS]))).toEqual([
            "GRAPH_LOOP_EXHAUSTED_MISSING poll",
        ])
        expect(codes(specOf([until({}, { body: "note", exhausted: "count" }), ...BODY, ...ENDS]))).toContain(
            "GRAPH_LOOP_EXHAUSTED_MISSING poll",
        )
        expect(codes(specOf([until({}, { exhausted: "gaveup" }), ...BODY, ...ENDS]))).toContain(
            "GRAPH_LOOP_BODY_MISSING poll",
        )
        expect(codes(specOf([until({ every: { minutes: 0 } }), ...BODY, ...ENDS]))).toEqual(["GRAPH_LOOP_EVERY poll"])
        expect(codes(specOf([until({ every: { minutes: 5, hours: 1 } }), ...BODY, ...ENDS]))).toEqual([
            "GRAPH_LOOP_EVERY poll",
        ])
        expect(codes(specOf([until({ every: { weeks: 1 } }), ...BODY, ...ENDS]))).toEqual(["GRAPH_LOOP_EVERY poll"])
        expect(
            codes(specOf([until({ until: { op: "like", ref: { $ref: "x" }, value: 1 } }), ...BODY, ...ENDS])),
        ).toEqual(["GRAPH_LOOP_CONDITION poll.until.op"])
        expect(codes(specOf([until({ until: { route: "done", stop: "stop" } }), ...BODY, ...ENDS]))).toEqual([
            "GRAPH_LOOP_CONDITION poll.until.route",
        ])
        expect(codes(specOf([until({ until: { and: [] } }), ...BODY, ...ENDS]))).toEqual([
            "GRAPH_LOOP_CONDITION poll.until.and",
        ])
    })

    it("refuses a loop nested in an until body and a body node reached from outside the loop", () => {
        const nested = specOf([
            until(),
            node("note", { step: TEMPLATE_UNTIL_STEP, next: "count" }),
            node("count"),
            ...ENDS,
        ])
        expect(graphLoopProblemsOf(nested).map((one) => one.code)).toContain("GRAPH_LOOP_NESTED")
        const shared = specOf([until(), ...BODY, node("done", { next: "count" }), node("gaveup")])
        expect(graphLoopProblemsOf(shared)).toContainEqual({ code: "GRAPH_LOOP_SHARED", at: "count" })
    })
})

describe("the conditions of the engine's if steps", () => {
    it("re-validates each `when` with the same check as an until condition", () => {
        const ifStep = (when: unknown) =>
            node("check", {
                step: TEMPLATE_IF_STEP,
                kind: "condition",
                params: { when } as never,
                routes: { yes: "done" },
            })
        expect(
            graphLoopProblemsOf(
                specOf([ifStep({ ref: { $ref: "trigger.x", default: null }, op: "eq", value: true }), node("done")]),
            ),
        ).toEqual([])
        expect(
            graphLoopProblemsOf(
                specOf([ifStep({ any: [{ ref: { $ref: "trigger.x" }, op: "present" }] }), node("done")]),
            ),
        ).toEqual([])
        expect(graphLoopProblemsOf(specOf([ifStep({ not: { ref: "x", op: "eq", value: 1 } }), node("done")]))).toEqual([
            { code: "GRAPH_LOOP_CONDITION", at: "check.when.not.ref" },
        ])
    })
})

describe("untilSettingsOf", () => {
    it("reads the condition, the cap and the wait, or null for any unreadable one", () => {
        expect(untilSettingsOf({ mode: "until", until: UNTIL, max: 3 })).toEqual({
            until: { kind: "data", expr: UNTIL },
            max: 3,
            everyMs: null,
        })
        expect(untilSettingsOf({ until: { route: "judge", stop: "stop" }, max: 10, every: { hours: 2 } })).toEqual({
            until: { kind: "meaning", node: "judge", stop: "stop" },
            max: 10,
            everyMs: 7_200_000,
        })
        expect(untilSettingsOf({ until: UNTIL, max: 3, every: { days: 31 } })).toBeNull()
        expect(untilSettingsOf({ until: UNTIL })).toBeNull()
        expect(untilSettingsOf({ max: 3 })).toBeNull()
    })
})
