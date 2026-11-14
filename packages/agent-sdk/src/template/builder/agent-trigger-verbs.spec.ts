import { z } from "zod"
import type { TriggerCondition } from "../../graph/workflow-contract"
import { PROVIDER, TRIGGER } from "../../names"
import type { ProviderKey, TriggerVerb } from "../../names"
import { VERB_SHARED_REFUSED, sharedVerbProblems } from "./agent-trigger-verbs"
import { node, trigger } from "./graph-builder"
import type { TemplateGraph } from "./graph-builder.types"
import { defineTemplateGraph } from "./graph-compile"
import { defineTemplateAgent, templateAgentProblems } from "./template-agent"
import { TemplateDefinitionError } from "./template-problems"

/** What a definition refusal names (its `params.at`: the definition and every problem); a coded error's message is only its code. */
const refusedAt = (define: () => unknown): string => {
    try {
        define()
    } catch (error) {
        return error instanceof TemplateDefinitionError ? String(error.params["at"]) : ""
    }
    return ""
}
import { remindNote } from "./template.fixture"

/** A one-step graph of the `test` agent woken by one verb under these conditions (none: absent `where`). */
const graphOn = (
    name: string,
    verb: TriggerVerb,
    where?: ReadonlyArray<TriggerCondition>,
    accounts?: ReadonlyArray<ProviderKey>,
): TemplateGraph =>
    defineTemplateGraph({
        key: `test.${name}`,
        title: { key: "g" },
        input: z.object({}),
        triggers: [
            trigger(verb, {
                ...(where === undefined ? {} : { where }),
                ...(accounts === undefined ? {} : { accounts }),
            }),
        ],
        start: "n",
        nodes: { n: node(remindNote, { input: { orderId: "o" } }) },
    })

const care = (name: string, where?: ReadonlyArray<TriggerCondition>): TemplateGraph => graphOn(name, TRIGGER.timerDue, where)

/** The verb-shared problems of an agent of these graphs, as `code@at (why)`. */
const sharedOf = (...graphs: [TemplateGraph, ...Array<TemplateGraph>]): ReadonlyArray<string> =>
    templateAgentProblems({
        key: "test",
        label: { key: "a" },
        accounts: [PROVIDER.zaloOa, PROVIDER.telegram],
        graphs,
        primary: graphs[0].key,
    })
        .filter((problem) => problem.code === "TRIGGER_VERB_SHARED")
        .map((problem) => `${problem.code}@${problem.at} (${problem.detail ?? ""})`)

const AT = "test.graphs"

describe("TRIGGER_VERB_SHARED: one verb on several graphs of one agent", () => {
    it("is legal when each graph keys the verb by `equals` on one param with disjoint values", () => {
        expect(
            sharedOf(
                care("a", [{ param: "careKind", op: "equals", value: "occasion" }]),
                care("b", [{ param: "careKind", op: "equals", value: "delivery-check" }]),
            ),
        ).toEqual([])
    })

    it("is legal with disjoint `in` lists", () => {
        expect(
            sharedOf(
                care("a", [{ param: "careKind", op: "in", value: ["payment-reminder", "payment-stale"] }]),
                care("b", [{ param: "careKind", op: "in", value: ["occasion", "delivery-check"] }]),
            ),
        ).toEqual([])
    })

    it("is legal with `equals` beside a disjoint `in` (the sales care graphs)", () => {
        expect(
            sharedOf(
                care("a", [{ param: "careKind", op: "in", value: ["payment-reminder", "payment-stale"] }]),
                care("b", [{ param: "careKind", op: "equals", value: "occasion" }]),
                care("c", [{ param: "careKind", op: "equals", value: "delivery-check" }]),
            ),
        ).toEqual([])
    })

    it("compares values as exact JSON scalars: the number 1 and the text '1' are disjoint", () => {
        expect(
            sharedOf(
                care("a", [{ param: "tier", op: "equals", value: 1 }]),
                care("b", [{ param: "tier", op: "in", value: ["1", 2] }]),
            ),
        ).toEqual([])
    })

    it("refuses overlapping values, naming both graphs", () => {
        expect(
            sharedOf(
                care("a", [{ param: "careKind", op: "in", value: ["occasion", "payment-stale"] }]),
                care("b", [{ param: "careKind", op: "equals", value: "occasion" }]),
                care("c", [{ param: "careKind", op: "equals", value: "delivery-check" }]),
            ),
        ).toEqual([
            `TRIGGER_VERB_SHARED@${AT}.test.a.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b, test.c: values-overlap with test.b)`,
            `TRIGGER_VERB_SHARED@${AT}.test.b.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b, test.c: values-overlap with test.a)`,
        ])
    })

    it("refuses a graph with no `where`", () => {
        expect(sharedOf(care("a", [{ param: "careKind", op: "equals", value: "occasion" }]), care("b"))).toEqual([
            `TRIGGER_VERB_SHARED@${AT}.test.b.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b: no-where)`,
        ])
    })

    it("refuses graphs keyed on different params", () => {
        expect(
            sharedOf(
                care("a", [{ param: "careKind", op: "equals", value: "occasion" }]),
                care("b", [{ param: "ref", op: "equals", value: "occasion" }]),
            ),
        ).toEqual([
            `TRIGGER_VERB_SHARED@${AT}.test.a.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b: different-params careKind, ref)`,
            `TRIGGER_VERB_SHARED@${AT}.test.b.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b: different-params careKind, ref)`,
        ])
    })

    it("refuses a non-exact op", () => {
        expect(
            sharedOf(
                care("a", [{ param: "careKind", op: "equals", value: "occasion" }]),
                care("b", [{ param: "careKind", op: "not-equals", value: "occasion" }]),
                care("c", [{ param: "careKind", op: "contains", value: "deliv" }]),
                care("d", [{ param: "careKind", op: "present" }]),
            ),
        ).toEqual([
            `TRIGGER_VERB_SHARED@${AT}.test.b.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b, test.c, test.d: op-not-exact not-equals)`,
            `TRIGGER_VERB_SHARED@${AT}.test.c.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b, test.c, test.d: op-not-exact contains)`,
            `TRIGGER_VERB_SHARED@${AT}.test.d.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b, test.c, test.d: op-not-exact present)`,
        ])
    })

    it("refuses several conditions, an `in` that is no list, and a value that is no scalar", () => {
        expect(
            sharedOf(
                care("a", [
                    { param: "careKind", op: "equals", value: "occasion" },
                    { param: "ref", op: "present" },
                ]),
                care("b", [{ param: "careKind", op: "in", value: "delivery-check" }]),
                care("c", [{ param: "careKind", op: "equals", value: { kind: "x" } }]),
            ),
        ).toEqual([
            `TRIGGER_VERB_SHARED@${AT}.test.a.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b, test.c: several-conditions)`,
            `TRIGGER_VERB_SHARED@${AT}.test.b.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b, test.c: value-not-scalar)`,
            `TRIGGER_VERB_SHARED@${AT}.test.c.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b, test.c: value-not-scalar)`,
        ])
    })

    it("judges conditions only: graphs bound to different providers do not make a shared verb legal", () => {
        expect(
            sharedOf(
                graphOn("a", TRIGGER.zaloMessageReceived, undefined, [PROVIDER.zaloOa]),
                graphOn("b", TRIGGER.zaloMessageReceived, undefined, [PROVIDER.telegram]),
            ),
        ).toEqual([
            `TRIGGER_VERB_SHARED@${AT}.test.a.triggers.0 (nivo.trigger.zalo.message.received shared by test.a, test.b: no-where)`,
            `TRIGGER_VERB_SHARED@${AT}.test.b.triggers.0 (nivo.trigger.zalo.message.received shared by test.a, test.b: no-where)`,
        ])
    })

    it("exempts `workflow.called`: a called graph is addressed by its pin, never by routing", () => {
        expect(sharedOf(graphOn("a", TRIGGER.workflowCalled), graphOn("b", TRIGGER.workflowCalled))).toEqual([])
    })

    it("names one verb used by one graph never", () => {
        expect(sharedOf(care("a"), graphOn("b", TRIGGER.clockTick, undefined))).toEqual([])
    })

    it("refuses the agent at definition, with the why in the thrown message", () => {
        const define = (): unknown =>
            defineTemplateAgent({
                key: "test",
                label: { key: "a" },
                accounts: [],
                graphs: [care("a"), care("b")],
                primary: "test.a",
            })
        expect(define).toThrow(TemplateDefinitionError)
        expect(refusedAt(define)).toContain("TRIGGER_VERB_SHARED@test.graphs.test.a.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b: no-where)")
    })

    it("the refusal is on: the shipped template agents hold no shared verb (dry run 2026-11-13)", () => {
        expect(VERB_SHARED_REFUSED).toBe(true)
        expect(sharedVerbProblems).toBeInstanceOf(Function)
    })
})

describe("TRIGGER_VERB_SHARED: per field of a declared record (`data.<key>`)", () => {
    const kind = (name: string, value: string): TemplateGraph =>
        care(name, [{ param: "data.kind", op: "equals", value }])

    it("is legal when both graphs constrain the same field path with different exact values", () => {
        expect(sharedOf(kind("a", "payment-reminder"), kind("b", "care"))).toEqual([])
    })

    it("is legal with disjoint `in` lists on the same field path", () => {
        expect(
            sharedOf(
                care("a", [{ param: "data.kind", op: "in", value: ["x", "y"] }]),
                care("b", [{ param: "data.kind", op: "equals", value: "z" }]),
            ),
        ).toEqual([])
    })

    it("refuses the same field path with the same value, naming both graphs", () => {
        expect(sharedOf(kind("a", "care"), kind("b", "care"))).toEqual([
            `TRIGGER_VERB_SHARED@${AT}.test.a.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b: values-overlap with test.b)`,
            `TRIGGER_VERB_SHARED@${AT}.test.b.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b: values-overlap with test.a)`,
        ])
    })

    it("refuses different field paths: nothing proves them disjoint", () => {
        expect(
            sharedOf(
                kind("a", "care"),
                care("b", [{ param: "data.stage", op: "equals", value: "care" }]),
            ),
        ).toEqual([
            `TRIGGER_VERB_SHARED@${AT}.test.a.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b: different-params data.kind, data.stage)`,
            `TRIGGER_VERB_SHARED@${AT}.test.b.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b: different-params data.kind, data.stage)`,
        ])
    })

    it("refuses a graph on `ref` beside one on `data.kind`, and a graph with no `where`", () => {
        expect(sharedOf(kind("a", "care"), care("b", [{ param: "ref", op: "equals", value: "r1" }]))).toHaveLength(2)
        expect(sharedOf(kind("a", "care"), care("b"))).toEqual([
            `TRIGGER_VERB_SHARED@${AT}.test.b.triggers.0 (nivo.trigger.timer.due shared by test.a, test.b: no-where)`,
        ])
    })
})
