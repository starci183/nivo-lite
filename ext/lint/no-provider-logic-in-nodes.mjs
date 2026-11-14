// project-ext/no-provider-logic-in-nodes
// ext/manifest.json rule NIVO-NODES-1 (doc ext/docs/NIVO-NODES-1.md); loaded by the harness under the plugin `project-ext` as `project-ext/no-provider-logic-in-nodes`.
// Enforces the node frame in package node code (`packages/*/src/**/nodes/**` and any file that calls `defineTemplateNode`):
//   - no `defineTool` / `defineEffect` / `defineNode` call: the engine alone defines tools and effects, and `defineNode` belongs only to
//     the four engine control nodes of `packages/blocks-core/src/shared/nodes/core/**`;
//   - no comparison of a value with a provider constant (`PROVIDER.x` of the names entry, or a generated `*_PROVIDER`): `===`, `!==`,
//     `==`, `!=`, a `switch` on it or a `case` of it. Providers are adapters the ToolRunner picks; a node never branches on one;
//   - no object property named `dedupeKey` / `onceKey`: the replay ledger keys calls, a node never types a dedupe key;
//   - no import from a `vocabulary/*effects*` module: effect payloads are the engine's.
// The engine's control nodes (`controlNodeFiles`, `packages/blocks-core/src/shared/nodes/core/**`: call-workflow, for-each, if, outcome and
// their specs) are the engine's own legacy `defineNode` code, not a package's feature: there `defineNode` is allowed, a hand-off may key
// its effect (`dedupeKey` / `onceKey`: the tag of the target agent is written once per run and target) and a file may import the
// core effects (`vocabulary/effects`, what a control node runs and its spec installs). `defineTool` / `defineEffect` and every
// provider comparison stay findings there too.
// Concept: .starciwork/concepts/tools.md (rule 6: only providers and the engine core define tools; nodes call them).
//   valid:   defineTemplateNode({ tools: [TOOL.orderGet], run: async (ctx) => ctx.tools.call(TOOL.orderGet, args) })
//   invalid: if (account.provider === PROVIDER.sepay) { … }
//   invalid: ctx.tools.call(TOOL.orderCreate, { dedupeKey: orderId })
//   invalid: import { ORDER_EFFECT } from "../../vocabulary/effects"
import {
    NAMES_SOURCES,
    TEMPLATE_SOURCE,
    calleeImport,
    conceptOf,
    importBindings,
    isGeneratedSource,
    matchesAny,
    relOf,
    unwrap,
} from "../support/lint-shared.mjs"

const CONCEPT = conceptOf("tools")

const DEFAULTS = {
    nodeFiles: ["packages/*/src/**/nodes/**"],
    controlNodeFiles: ["packages/blocks-core/src/shared/nodes/core/**"],
}

/** The SDK's definition helpers a node file never calls (defineNode: only the control nodes). */
const DEFINITIONS = new Set(["defineTool", "defineEffect", "defineNode"])

/** The property names the replay ledger owns. */
const LEDGER_KEYS = new Set(["dedupeKey", "onceKey"])

/** Whether an import source is an effects module of a vocabulary folder (`…/vocabulary/effects`, `…/vocabulary/crm-effects.ts`). */
const isEffectsModule = (source) => {
    const parts = source.split("/")
    return parts.length >= 2 && parts[parts.length - 2] === "vocabulary" && parts[parts.length - 1].includes("effects")
}

const keyName = (property) => {
    if (property.computed) return property.key.type === "Literal" ? String(property.key.value) : null
    return property.key.type === "Identifier"
        ? property.key.name
        : property.key.type === "Literal"
          ? String(property.key.value)
          : null
}

export default {
    meta: {
        type: "problem",
        docs: {
            description: "Node code holds one feature's logic: no tool, effect or provider logic",
            concept: CONCEPT,
        },
        schema: [
            {
                type: "object",
                properties: {
                    nodeFiles: { type: "array", items: { type: "string" } },
                    controlNodeFiles: { type: "array", items: { type: "string" } },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            definition:
                "node code calls `{{name}}`; the engine alone defines tools and effects, `defineNode` only the control nodes ({{concept}})",
            provider:
                "node code compares with a provider constant; providers are adapters the ToolRunner picks, a node never branches on one ({{concept}})",
            ledgerKey:
                "node code writes `{{name}}`; the replay ledger keys calls, a node types no dedupe key ({{concept}})",
            effects:
                "node code imports `{{source}}`, an effects module; effect payloads are the engine's ({{concept}})",
        },
    },
    create(context) {
        const options = { ...DEFAULTS, ...(context.options[0] ?? {}) }
        const rel = relOf(context)
        const { bindings, visit } = importBindings()
        const isControl = matchesAny(rel, options.controlNodeFiles)
        let isNode = matchesAny(rel, options.nodeFiles)
        const pending = []
        const later = (descriptor) => pending.push(descriptor)

        /** Whether an expression is a provider constant: `PROVIDER.x` of the names entry, or an imported generated `*_PROVIDER`. */
        const isProvider = (expression) => {
            const node = unwrap(expression)
            if (node?.type === "Identifier") {
                const binding = bindings.get(node.name)
                return binding !== undefined && isGeneratedSource(binding.source) && /_PROVIDER$/.test(binding.imported)
            }
            if (node?.type !== "MemberExpression") return false
            const object = unwrap(node.object)
            if (object?.type !== "Identifier") return false
            const binding = bindings.get(object.name)
            return binding !== undefined && binding.imported === "PROVIDER" && NAMES_SOURCES.has(binding.source)
        }

        return {
            ImportDeclaration(node) {
                visit(node)
                if (!isControl && isEffectsModule(node.source.value))
                    later({
                        node: node.source,
                        messageId: "effects",
                        data: { source: node.source.value, concept: CONCEPT },
                    })
            },
            CallExpression(node) {
                const binding = calleeImport(bindings, node)
                if (binding === null) return
                if (binding.source === TEMPLATE_SOURCE && binding.imported === "defineTemplateNode") isNode = true
                if (DEFINITIONS.has(binding.imported) && !(binding.imported === "defineNode" && isControl))
                    later({
                        node: node.callee,
                        messageId: "definition",
                        data: { name: binding.imported, concept: CONCEPT },
                    })
            },
            BinaryExpression(node) {
                if (!["===", "!==", "==", "!="].includes(node.operator)) return
                if (isProvider(node.left) || isProvider(node.right))
                    later({ node, messageId: "provider", data: { concept: CONCEPT } })
            },
            SwitchStatement(node) {
                if (isProvider(node.discriminant))
                    later({ node: node.discriminant, messageId: "provider", data: { concept: CONCEPT } })
                for (const branch of node.cases)
                    if (branch.test !== null && isProvider(branch.test))
                        later({ node: branch.test, messageId: "provider", data: { concept: CONCEPT } })
            },
            Property(node) {
                const name = keyName(node)
                if (!isControl && name !== null && LEDGER_KEYS.has(name))
                    later({ node: node.key, messageId: "ledgerKey", data: { name, concept: CONCEPT } })
            },
            "Program:exit"() {
                if (!isNode) return
                for (const descriptor of pending) context.report(descriptor)
            },
        }
    },
}
