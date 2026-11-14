// project-ext/graphs-are-data
// ext/manifest.json rule NIVO-GRAPHS-1 (doc ext/docs/NIVO-GRAPHS-1.md); loaded by the harness under the plugin `project-ext` as `project-ext/graphs-are-data`.
// Enforces "packages describe, the engine runs": the argument of `defineTemplateGraph(...)` and of every control builder of
// `@nivo-lite/agent-sdk/template` (`node`, `loop`, `ifNode`, `callWorkflow`, `callWorkflows`, `outcome`, `trigger`) is serializable data.
// No VALUE inside it (an argument, a property value, an array element, reached through objects, arrays, spreads, conditionals and the
// calls of the template entry such as `ref`, `item` and the expression builders) is a function expression, an arrow function, a method
// shorthand or accessor, a `new` expression, a class or an `await`. Identifiers (template nodes, constants), member reads and calls of
// anything else (a local helper that returns steps) are values computed when the package is built, and are fine.
// Concept: .starciwork/concepts/templates.md (rule 2: "everything inside a template graph is serializable data … every condition is the engine's
// declarative expression language, never a function").
//   valid:   ifNode({ when: equals(ref("steps.read.output.status"), "paid"), then: "notice", else: "end" })
//   invalid: ifNode({ when: (state) => state.paid, then: "notice", else: "end" })
//   invalid: loop({ over: ref("steps.list.output.items"), key: "id", body: { async run() {} }, max: 10, next: "end" })
// Scope: ext/manifest.json rule NIVO-GRAPHS-1 `appliesTo` (packages/*/src, .ts and .tsx). The manifest has no `excludes`, so the rule itself
// leaves out the SDK that DEFINES the builders (packages/agent-sdk/**: its own implementation and specs build graphs from functions by
// design). Doc: ext/docs/NIVO-GRAPHS-1.md.
import { TEMPLATE_SOURCE, calleeImport, conceptOf, importBindings, matchesAny, relOf, unwrap } from "../support/lint-shared.mjs"

const CONCEPT = conceptOf("templates")

/** The home of the template builders: not judged (the old manifest's `excludes`). */
const NOT_JUDGED = ["packages/agent-sdk/**"]

/** The builders whose arguments are a graph's data. Each call is judged where it stands, wherever it is in the file. */
const BUILDERS = new Set([
    "defineTemplateGraph",
    "node",
    "loop",
    "ifNode",
    "callWorkflow",
    "callWorkflows",
    "outcome",
    "trigger",
])

export default {
    meta: {
        type: "problem",
        docs: {
            description: "A template graph and its control builders take serializable data only",
            concept: CONCEPT,
        },
        schema: [],
        messages: {
            code: "{{what}} inside the data of `{{builder}}(...)`; a template graph is serializable data, conditions are expressions ({{concept}})",
        },
    },
    create(context) {
        if (matchesAny(relOf(context), NOT_JUDGED)) return {}
        const { bindings, visit } = importBindings()
        const templateCall = (node) => {
            const binding = node.type === "CallExpression" ? calleeImport(bindings, node) : null
            return binding !== null && binding.source === TEMPLATE_SOURCE ? binding.imported : null
        }
        const report = (node, what, builder) =>
            context.report({ node, messageId: "code", data: { what, builder, concept: CONCEPT } })

        const judge = (value, builder) => {
            const node = unwrap(value)
            if (node === null || node === undefined) return
            switch (node.type) {
                case "FunctionExpression":
                case "ArrowFunctionExpression":
                    return report(node, node.async ? "an async function" : "a function", builder)
                case "ClassExpression":
                    return report(node, "a class", builder)
                case "NewExpression":
                    return report(node, "a `new` expression", builder)
                case "AwaitExpression":
                    return report(node, "an `await`", builder)
                case "ObjectExpression":
                    for (const property of node.properties) {
                        if (property.type === "SpreadElement") judge(property.argument, builder)
                        else if (property.method || property.kind === "get" || property.kind === "set")
                            report(property, "a method", builder)
                        else judge(property.value, builder)
                    }
                    return
                case "ArrayExpression":
                    for (const element of node.elements)
                        judge(element?.type === "SpreadElement" ? element.argument : element, builder)
                    return
                case "ConditionalExpression":
                    judge(node.consequent, builder)
                    return judge(node.alternate, builder)
                case "LogicalExpression":
                    judge(node.left, builder)
                    return judge(node.right, builder)
                case "CallExpression": {
                    const imported = templateCall(node)
                    // A nested control builder is judged by its own visit; another call of the template entry (ref, item, equals …) is data.
                    if (imported !== null && !BUILDERS.has(imported))
                        for (const argument of node.arguments) judge(argument, builder)
                    return
                }
                default:
                    return
            }
        }

        return {
            ImportDeclaration: visit,
            CallExpression(node) {
                const imported = templateCall(node)
                if (imported === null || !BUILDERS.has(imported)) return
                for (const argument of node.arguments)
                    judge(argument.type === "SpreadElement" ? argument.argument : argument, imported)
            },
        }
    },
}
