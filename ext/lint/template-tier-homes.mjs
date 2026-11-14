// project-ext/template-tier-homes
// ext/manifest.json rule NIVO-TIERS-1 (doc ext/docs/NIVO-TIERS-1.md); loaded by the harness under the plugin `project-ext` as `project-ext/template-tier-homes`.
// Enforces where each tier is written:
//   - `defineNode` (the engine's node tier) is imported (or re-exported) under `packages/**` only by its home `packages/agent-sdk/**` and by
//     the four engine control nodes `packages/blocks-core/src/shared/nodes/core/**`; every other package node is a `defineTemplateNode`;
//   - `defineTemplateNode` / `defineTemplateGraph` / `defineTemplateAgent` (the package tiers) are not imported under `be/src/**`: the engine
//     holds running nodes as DATA (template id + pinned version), never a template of its own. Allowed there: test fixtures
//     `be/src/tests/**` and specs `*.spec.ts`.
// Concept: .starciwork/concepts/templates.md (rule 1: templates live in packages, `defineNode` and the running tier in the engine).
//   valid   (packages/blocks-core/src/agents/sales/nodes/x.node.ts): import { defineTemplateNode } from "@nivo-lite/agent-sdk/template"
//   invalid (packages/blocks-core/src/agents/sales/nodes/x.node.ts): import { defineNode } from "@nivo-lite/agent-sdk/node"
//   invalid (be/src/modules/domain/x/x.service.ts):            import { defineTemplateGraph } from "@nivo-lite/agent-sdk/template"
import { conceptOf, matchesAny, relOf } from "../support/lint-shared.mjs"

const TEMPLATES = conceptOf("templates")

const DEFAULTS = {
    nodeTierScope: ["packages/**"],
    nodeTierHomes: ["packages/agent-sdk/**", "packages/blocks-core/src/shared/nodes/core/**"],
    templateTierScope: ["be/src/**"],
    templateTierHomes: ["be/src/tests/**", "**/*.spec.ts"],
}

const TEMPLATE_TIERS = new Set(["defineTemplateNode", "defineTemplateGraph", "defineTemplateAgent"])

const nameOf = (identifier) => (identifier.type === "Identifier" ? identifier.name : identifier.value)

export default {
    meta: {
        type: "problem",
        docs: {
            description: "defineNode only in the SDK and the control nodes; the template tiers never in the engine",
            concept: [TEMPLATES],
        },
        schema: [
            {
                type: "object",
                properties: Object.fromEntries(
                    Object.keys(DEFAULTS).map((key) => [key, { type: "array", items: { type: "string" } }]),
                ),
                additionalProperties: false,
            },
        ],
        messages: {
            nodeTier:
                "`defineNode` is the engine's node tier: a package node is a `defineTemplateNode` (only packages/agent-sdk and the control nodes of blocks-core/src/nodes/core hold defineNode) ({{concept}})",
            templateTier:
                "`{{name}}` is a package tier; the engine holds running nodes as data, never a template of its own (fixtures and specs excepted) ({{concept}})",
        },
    },
    create(context) {
        const options = { ...DEFAULTS, ...(context.options[0] ?? {}) }
        const rel = relOf(context)
        const nodeTierBanned = matchesAny(rel, options.nodeTierScope) && !matchesAny(rel, options.nodeTierHomes)
        const templateTierBanned =
            matchesAny(rel, options.templateTierScope) && !matchesAny(rel, options.templateTierHomes)
        const judge = (specifier, name) => {
            if (name === "defineNode" && nodeTierBanned)
                context.report({ node: specifier, messageId: "nodeTier", data: { concept: TEMPLATES } })
            if (TEMPLATE_TIERS.has(name) && templateTierBanned)
                context.report({ node: specifier, messageId: "templateTier", data: { name, concept: TEMPLATES } })
        }
        return {
            ImportSpecifier(node) {
                if (node.importKind === "type" || node.parent.importKind === "type") return
                judge(node, nameOf(node.imported))
            },
            ExportSpecifier(node) {
                if (node.parent.source === null || node.exportKind === "type" || node.parent.exportKind === "type")
                    return
                judge(node, nameOf(node.local))
            },
        }
    },
}
