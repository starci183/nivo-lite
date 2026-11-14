// project-ext/node-level-names
// ext/manifest.json rule NIVO-NAMES-2 (doc ext/docs/NIVO-NAMES-2.md); loaded by the harness under the plugin `project-ext` as `project-ext/node-level-names`.
// Enforces the level of each NIVO name by where it is used:
//   (1) node code (`packages/*/src/**/nodes/**` and any file that calls `defineTemplateNode`) imports no `API` from the names entry and no
//       generated `*_API` map: a node calls tools (`TOOL`), never a provider's raw API;
//   (2) in a file that calls `defineTemplateGraph`, the verb of every `trigger(...)` is a member of `TRIGGER` (`trigger(TRIGGER.x, …)`);
//   (3) interfaces (`fe/**`, workbench specs `packages/*/src/**/specs/**`, `**/workbench/**`) import no `TOOL` from the names entry and no
//       generated tool map (the generator's bare `<KEY>` export: anything of a `*.generated` file that is neither `*_API` nor `*_PROVIDER`):
//       an interface reads `API` / a generated `*_API`, never a node's tool.
// Concepts: .starciwork/concepts/tools.md (api = interfaces only, tool = nodes only) and .starciwork/concepts/triggers.md (trigger verbs are TRIGGER names).
//   valid (node):      import { TOOL } from "@nivo-lite/agent-sdk/names"
//   invalid (node):    import { API } from "@nivo-lite/agent-sdk/names"
//   valid (graph):     triggers: [trigger(TRIGGER.workflowCalled)]
//   invalid (graph):   triggers: [trigger(someVerb)]
//   valid (fe):        import { API } from "@nivo-lite/agent-sdk/names"
//   invalid (fe):      import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    NAMES_SOURCES,
    TEMPLATE_SOURCE,
    calleeImport,
    conceptOf,
    importBindings,
    isGeneratedSource,
    isNamesMember,
    matchesAny,
    relOf,
} from "../support/lint-shared.mjs"

const LEVELS = conceptOf("tools")
const TRIGGERS = conceptOf("triggers")

const DEFAULTS = {
    nodeFiles: ["packages/*/src/**/nodes/**"],
    interfaceFiles: ["fe/**", "packages/*/src/**/specs/**", "**/workbench/**"],
}

export default {
    meta: {
        type: "problem",
        docs: {
            description: "Nodes name TOOL, graph triggers name TRIGGER, interfaces name API",
            concept: [LEVELS, TRIGGERS],
        },
        schema: [
            {
                type: "object",
                properties: {
                    nodeFiles: { type: "array", items: { type: "string" } },
                    interfaceFiles: { type: "array", items: { type: "string" } },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            nodeApi:
                "node code imports `{{name}}`, a provider's raw API; a node names tools only (`TOOL`) ({{concept}})",
            triggerVerb:
                "the verb of `trigger(...)` is a member of `TRIGGER` (`trigger(TRIGGER.<name>, …)`) ({{concept}})",
            interfaceTool:
                "an interface imports `{{name}}`, a node's tool names; an interface names `API` / a generated `*_API` only ({{concept}})",
        },
    },
    create(context) {
        const options = { ...DEFAULTS, ...(context.options[0] ?? {}) }
        const rel = relOf(context)
        const { bindings, visit } = importBindings()
        const isInterface = matchesAny(rel, options.interfaceFiles)
        let isNode = matchesAny(rel, options.nodeFiles)
        let isGraph = false
        const triggerCalls = []

        const apiImport = ({ imported, source }) =>
            (imported === "API" && NAMES_SOURCES.has(source)) || /_API$/.test(imported)
        const toolImport = ({ imported, source }) =>
            (imported === "TOOL" && NAMES_SOURCES.has(source)) ||
            (isGeneratedSource(source) && !/_(API|PROVIDER)$/.test(imported))

        return {
            ImportDeclaration: visit,
            CallExpression(node) {
                const binding = calleeImport(bindings, node)
                if (binding === null || binding.source !== TEMPLATE_SOURCE) return
                if (binding.imported === "defineTemplateNode") isNode = true
                if (binding.imported === "defineTemplateGraph") isGraph = true
                if (binding.imported === "trigger") triggerCalls.push(node)
            },
            "Program:exit"() {
                for (const [local, binding] of bindings) {
                    if (isNode && apiImport(binding))
                        context.report({
                            node: binding.node,
                            messageId: "nodeApi",
                            data: { name: local, concept: LEVELS },
                        })
                    if (isInterface && toolImport(binding))
                        context.report({
                            node: binding.node,
                            messageId: "interfaceTool",
                            data: { name: local, concept: LEVELS },
                        })
                }
                if (!isGraph) return
                for (const call of triggerCalls) {
                    const verb = call.arguments[0]
                    if (verb === undefined || !isNamesMember(bindings, verb, "TRIGGER"))
                        context.report({ node: verb ?? call, messageId: "triggerVerb", data: { concept: TRIGGERS } })
                }
            },
        }
    },
}
