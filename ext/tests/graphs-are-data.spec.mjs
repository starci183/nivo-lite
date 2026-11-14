import rule from "../lint/graphs-are-data.mjs"
import { at, tester } from "./tester.mjs"

const file = at("packages/blocks-core/src/modules/sales/template/example.graph.ts")
const T =
    'import { callWorkflow, defineTemplateGraph, equals, ifNode, loop, node, outcome, ref, trigger } from "@nivo-lite/agent-sdk/template"\n'

tester.run("graphs-are-data", rule, {
    valid: [
        {
            filename: file,
            code: `${T}export const g = defineTemplateGraph({ key: "a.b", triggers: [trigger(TRIGGER.workflowCalled)], start: "read", nodes: { read: node(readNode, { input: { id: ref("input.id") }, next: "check" }), check: ifNode({ when: equals(ref("steps.read.output.status"), "paid"), then: "end", else: "end" }), end: outcome("done") } })`,
        },
        // A local helper that builds steps is computed when the package builds: its body is judged only through the builders it calls.
        {
            filename: file,
            code: `${T}const tail = (suffix: string) => ({ [\`end\${suffix}\`]: outcome("done") })\nexport const g = defineTemplateGraph({ nodes: { ...tail("") } })`,
        },
        {
            filename: file,
            code: `${T}export const g = defineTemplateGraph({ nodes: Object.fromEntries(KEYS.map((k) => [k, outcome(k)])) })`,
        },
        // A defineTemplateNode's run is the one piece of logic a package writes: not a graph builder.
        {
            filename: file,
            code: 'import { defineTemplateNode } from "@nivo-lite/agent-sdk/template"\nexport const n = defineTemplateNode({ run: async () => ({}) })',
        },
        // Another library's `node` is not the builder.
        { filename: file, code: 'import { node } from "elsewhere"\nexport const x = node({ run: () => 1 })' },
        // The SDK that defines the builders is not judged (the old manifest's `excludes`, now inside the rule).
        {
            filename: at("packages/agent-sdk/src/template/loop.spec.ts"),
            code: `${T}export const l = loop({ over: ref("x"), key: "id", body: { async run() {} }, max: 1, next: "end" })`,
        },
    ],
    invalid: [
        {
            filename: file,
            code: `${T}export const g = ifNode({ when: (state) => state.paid, then: "a", else: "b" })`,
            errors: [{ messageId: "code" }],
        },
        {
            filename: file,
            code: `${T}export const g = defineTemplateGraph({ nodes: { a: node(x, { input: { at: function () { return 1 } } }) } })`,
            errors: [{ messageId: "code" }],
        },
        {
            filename: file,
            code: `${T}export const g = loop({ over: ref("steps.a.output.items"), key: "id", body: { run() {} }, max: 10, next: "end" })`,
            errors: [{ messageId: "code" }],
        },
        {
            filename: file,
            code: `${T}export const g = defineTemplateGraph({ key: "a.b", at: new Date() })`,
            errors: [{ messageId: "code" }],
        },
        {
            filename: file,
            code: `${T}export const g = callWorkflow({ target: class {} })`,
            errors: [{ messageId: "code" }],
        },
        {
            filename: file,
            code: `${T}export const g = outcome({ value: async () => 1 })`,
            errors: [{ messageId: "code" }],
        },
        {
            filename: file,
            code: `${T}export const g = ifNode({ when: equals(ref("a"), () => 1), then: "a", else: "b" })`,
            errors: [{ messageId: "code" }],
        },
        {
            filename: file,
            code: `${T}export const g = defineTemplateGraph({ triggers: [trigger(TRIGGER.clockTick, { args: { get preset() { return "x" } } })] })`,
            errors: [{ messageId: "code" }],
        },
    ],
})
