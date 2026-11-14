import { z } from "zod"
import { PROVIDER, TRIGGER } from "../../names"
import { callWorkflow, endRound, equals, ifNode, loop, node, outcome, ref, trigger, wait, waitFor } from "./graph-builder"
import type { GraphStep, TemplateGraphConfig } from "./graph-builder.types"
import { compileTemplateGraph } from "./graph-compile"
import { type TemplateTriggerLookup, templateGraphProblems } from "./graph-problems"
import type { TemplateProblem } from "./template-problems"
import { listOrders, openToolLookup, remindNote } from "./template.fixture"

// Two save rules of the owner's final rule (2026-11-14): a graph woken by a person on an account ENDS at a hand-off (`GRAPH_HANDOFF_NOT_LAST`,
// coordinator ruling R10), and an `until` loop whose body parks at a `wait` may run up to 30 rounds, any other up to 10 (R9).

const codesOf = (problems: ReadonlyArray<TemplateProblem>): ReadonlyArray<string> => problems.map((one) => `${one.code}@${one.at}`)

/** The engine's lookup as these cases assume it: a Zalo message names a person on an account (it supplies `routeId`), a call does not. */
const triggers: TemplateTriggerLookup = {
    supplies: (verb) => {
        if (verb === TRIGGER.workflowCalled) return { kind: "caller" }
        if (verb === TRIGGER.clockTick) return { kind: "fixed", params: [{ name: "eventId", type: "string" }] }
        if (verb === TRIGGER.zaloMessageReceived)
            return {
                kind: "fixed",
                params: [
                    { name: "eventId", type: "string" },
                    { name: "routeId", type: "string" },
                    { name: "data", type: "object" },
                ],
            }
        return { kind: "unknown" }
    },
}

const problemsOf = (config: TemplateGraphConfig): ReadonlyArray<string> => {
    const compiled = compileTemplateGraph(config)
    return codesOf([
        ...compiled.problems,
        ...templateGraphProblems(compiled.graph.spec, { nodes: compiled.graph.nodes, tools: openToolLookup, triggers, nullability: "strict" }),
    ])
}

const handOffGraph = (verb: typeof TRIGGER.zaloMessageReceived | typeof TRIGGER.clockTick, hand: GraphStep): TemplateGraphConfig => ({
    key: "test.handoff",
    title: { key: "g" },
    input: z.object({}),
    triggers: [verb === TRIGGER.zaloMessageReceived ? trigger(verb, { accounts: [PROVIDER.zaloOa] }) : trigger(verb, { args: { preset: "hourly" } })],
    start: "list",
    nodes: {
        list: node(listOrders, { next: "hand" }),
        hand,
        after: node(remindNote, { input: { orderId: "o" }, next: "done" }),
        done: outcome({ name: "done" }),
    },
})

describe("a person's graph ends at a hand-off (GRAPH_HANDOFF_NOT_LAST)", () => {
    it("a graph woken by a person on an account may not go on after a callWorkflow", () => {
        expect(problemsOf(handOffGraph(TRIGGER.zaloMessageReceived, callWorkflow({ agent: "sales", workflow: "sale", input: {}, next: "after" })))).toContain(
            "GRAPH_HANDOFF_NOT_LAST@nodes.hand",
        )
    })

    it("the same hand-off with no next ends the run and is sound", () => {
        expect(problemsOf(handOffGraph(TRIGGER.zaloMessageReceived, callWorkflow({ agent: "sales", workflow: "sale", input: {} })))).not.toContain(
            "GRAPH_HANDOFF_NOT_LAST@nodes.hand",
        )
    })

    it("a graph no person wakes (the clock) may call a workflow and go on", () => {
        expect(problemsOf(handOffGraph(TRIGGER.clockTick, callWorkflow({ agent: "sales", workflow: "sale", input: {}, next: "after" })))).not.toContain(
            "GRAPH_HANDOFF_NOT_LAST@nodes.hand",
        )
    })
})

const roundsGraph = (max: 10 | 11 | 30, withWait: boolean): TemplateGraphConfig => ({
    key: "test.rounds",
    title: { key: "g" },
    input: z.object({}),
    triggers: [trigger(TRIGGER.workflowCalled)],
    start: "talk",
    nodes: {
        talk: loop({
            until: equals(ref("steps.list.output.done", { default: false }), true),
            max,
            body: withWait
                ? {
                      start: "list",
                      nodes: {
                          list: node(listOrders, { next: "hear" }),
                          hear: wait({ for: { said: waitFor(TRIGGER.zaloMessageReceived) }, timeout: "1d", next: { said: endRound, timeout: endRound } }),
                      },
                  }
                : { start: "list", nodes: { list: node(listOrders) } },
            next: "done",
            exhausted: "done",
        }),
        done: outcome({ name: "done" }),
    },
})

describe("the rounds of an until loop (R9)", () => {
    it("a body that parks at a wait may declare up to 30 rounds", () => {
        expect(problemsOf(roundsGraph(30, true)).filter((code) => code.startsWith("LOOP_MAX_INVALID"))).toEqual([])
    })

    it("a body with no wait keeps 1 to 10", () => {
        expect(problemsOf(roundsGraph(10, false)).filter((code) => code.startsWith("LOOP_MAX_INVALID"))).toEqual([])
        expect(new Set(problemsOf(roundsGraph(11, false)).filter((code) => code.startsWith("LOOP_MAX_INVALID")))).toEqual(new Set(["LOOP_MAX_INVALID@nodes.talk.params.max"]))
    })
})

/** A talk loop whose `note` step reads what it noted the round before (R13). */
const carryGraph = (carry: GraphStep): TemplateGraphConfig => ({
    key: "test.carry",
    title: { key: "g" },
    input: z.object({}),
    triggers: [trigger(TRIGGER.workflowCalled)],
    start: "talk",
    nodes: {
        talk: loop({
            until: equals(ref("steps.note.output.noted", { default: "" }), "done"),
            max: 30,
            body: {
                start: "note",
                nodes: {
                    note: carry,
                    // A wait names a body step on every route (no `endRound`): a data `if` with no `no` ends the round on both.
                    hear: wait({ for: { said: waitFor(TRIGGER.zaloMessageReceived) }, timeout: "1d", next: { said: "heard", timeout: "heard" } }),
                    heard: ifNode({ when: equals(ref("steps.hear.output.trigger"), "said"), yes: endRound }),
                },
            },
            next: "done",
            exhausted: "done",
        }),
        after: node(remindNote, { input: { orderId: ref("steps.note.output.noted", { round: "previous", default: "" }) }, next: "done" }),
        done: outcome({ name: "done" }),
    },
})

describe("a ref to the round before (R13)", () => {
    it("a body step reads its own output of the round before, with the default round 1 reads", () => {
        const codes = problemsOf(carryGraph(node(remindNote, { input: { orderId: ref("steps.note.output.noted", { round: "previous", default: "" }) }, next: "hear" })))
        expect(codes.filter((code) => code.includes("nodes.note."))).toEqual([])
        const compiled = compileTemplateGraph(carryGraph(node(remindNote, { input: { orderId: ref("steps.note.output.noted", { round: "previous", default: "" }) }, next: "hear" })))
        expect(JSON.stringify(compiled.graph.spec)).toContain('"round":"previous"')
    })

    it("is refused without a default, and outside the body", () => {
        expect(problemsOf(carryGraph(node(remindNote, { input: { orderId: ref("steps.note.output.noted", { round: "previous" }) }, next: "hear" })))).toContain(
            "GRAPH_REF_ROUND_INVALID@nodes.note.params.orderId<-steps.note.output.noted",
        )
        // `after` sits outside the body: its round ref is refused.
        expect(problemsOf(carryGraph(node(remindNote, { input: { orderId: "x" }, next: "hear" })))).toContain(
            "GRAPH_REF_ROUND_INVALID@nodes.after.params.orderId<-steps.note.output.noted",
        )
    })
})
