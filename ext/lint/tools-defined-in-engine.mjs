// project-ext/tools-defined-in-engine
// ext/manifest.json rule NIVO-TOOLS-1 (doc ext/docs/NIVO-TOOLS-1.md); loaded by the harness under the plugin `project-ext` as `project-ext/tools-defined-in-engine`.
// Enforces that a tool is DEFINED only where the concept places tool definitions: a `defineTool(...)` call, or an object literal assigned
// to a `*TOOL_SPECS` registry (`export const TOOL_SPECS = { … }`), appears only in these homes:
//   - be/src/modules/domain/tool-specs/**   the engine's tool specs (class, args, adapters per provider, owner by data): the one home;
//   - be/src/tests/**, be/src/**/*.spec.ts  the engine's own fixtures and specs (the engine is the home, its tests probe it);
//   - packages/agent-sdk/**                 the home of `defineTool` itself (the contract helper and its own specs);
//   - packages/blocks-core/src/vocabulary/**          the platform purpose contracts the engine still serves (declared before the flip);
//   - packages/nivo-web-core/src/vocabulary/crm-tools.ts  the CRM's declared contract (its OpenAPI operations as tools), likewise.
// The two vocabulary homes are the declared contracts that exist today; they stay allowed until the engine's specs absorb them. Every
// other `defineTool` or registry literal (a plugin's own vocabulary file, a package spec defining tools) is a finding.
// Concept: .starciwork/concepts/tools.md (rule 6: only providers and the engine core define tools).
//   valid   (be/src/modules/domain/tool-specs/tool-specs.policy.ts): export const TOOL_SPECS = { … }
//   invalid (packages/nivo-web-core/src/vocabulary/mail-tools.ts):  export const mailListTool = defineTool({ … })
import { calleeImport, conceptOf, importBindings, matchesAny, relOf, unwrap } from "../support/lint-shared.mjs"

const CONCEPT = conceptOf("tools")

const DEFAULTS = {
    homes: [
        "be/src/modules/domain/tool-specs/**",
        "be/src/tests/**",
        "be/src/**/*.spec.ts",
        "packages/agent-sdk/**",
        "packages/blocks-core/src/vocabulary/**",
        "packages/nivo-web-core/src/vocabulary/crm-tools.ts",
    ],
}

export default {
    meta: {
        type: "problem",
        docs: {
            description: "Tools are defined in the engine's tool specs and the declared vocabulary contracts only",
            concept: CONCEPT,
        },
        schema: [
            {
                type: "object",
                properties: { homes: { type: "array", items: { type: "string" } } },
                additionalProperties: false,
            },
        ],
        messages: {
            defineTool:
                "`defineTool` outside the homes of tool definitions; the engine alone defines tools (be/src/modules/domain/tool-specs) ({{concept}})",
            registry: "`{{name}}` holds tool specs outside the engine's tool-specs home ({{concept}})",
        },
    },
    create(context) {
        const options = { ...DEFAULTS, ...(context.options[0] ?? {}) }
        if (matchesAny(relOf(context), options.homes)) return {}
        const { bindings, visit } = importBindings()
        return {
            ImportDeclaration: visit,
            CallExpression(node) {
                const binding = calleeImport(bindings, node)
                if (binding !== null && binding.imported === "defineTool")
                    context.report({ node: node.callee, messageId: "defineTool", data: { concept: CONCEPT } })
            },
            VariableDeclarator(node) {
                if (node.id.type !== "Identifier" || !/TOOL_SPECS$/.test(node.id.name)) return
                if (unwrap(node.init)?.type === "ObjectExpression")
                    context.report({
                        node: node.id,
                        messageId: "registry",
                        data: { name: node.id.name, concept: CONCEPT },
                    })
            },
        }
    },
}
