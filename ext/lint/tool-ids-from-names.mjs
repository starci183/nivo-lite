// project-ext/tool-ids-from-names
// ext/manifest.json rule NIVO-NAMES-1 (doc ext/docs/NIVO-NAMES-1.md); loaded by the harness under the plugin `project-ext` as `project-ext/tool-ids-from-names`.
// Enforces: no string literal and no template literal whose WHOLE text is a NIVO verb (`nivo.api.*`, `nivo.tool.*`, `nivo.trigger.*`
// by the SDK's id grammar `NIVO_VERB`), and no template literal BUILT into one (`nivo.tool.${x}`). A package names a verb only through
// `TOOL` / `TRIGGER` / `API` / `PROVIDER` of `@nivo-lite/agent-sdk/names` or a generated map (`CRM`, `CRM_API`), so a rename is one
// line and an undeclared verb does not compile.
// Concept: .starciwork/concepts/tools.md (Naming: constants only; also "A tool id typed as a string in code").
// Scope: ext/manifest.json rule NIVO-NAMES-1 `appliesTo` (packages/blocks-core/src and packages/nivo-web-core/src, .ts and .tsx). The
// manifest has no `excludes` (the harness refuses any extra key), so the rule itself leaves out the two file kinds that may hold a verb as
// text: a generated names file (`*.generated.ts`: the generator writes the map) and a spec (`*.spec.ts(x)`: it asserts the ids). Doc:
// ext/docs/NIVO-NAMES-1.md.
//   valid:   tools: [TOOL.customerMessageSend]
//   invalid: tools: ["nivo.tool.customer.message.send"]
//   invalid: const id = `nivo.tool.crm.${operation}`
import { NIVO_VERB, NIVO_VERB_HEAD, conceptOf, matchesAny, relOf } from "../support/lint-shared.mjs"

const CONCEPT = conceptOf("tools")

/** The files inside `appliesTo` this rule does not judge: the generated names maps and the specs (the old manifest's `excludes`). */
const NOT_JUDGED = ["**/*.generated.ts", "**/*.spec.ts", "**/*.spec.tsx"]

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "A NIVO verb is named through TOOL / TRIGGER / API / PROVIDER or a generated map, never typed as text",
            concept: CONCEPT,
        },
        schema: [],
        messages: {
            typed: '"{{text}}" is a NIVO verb typed as text; name it through TOOL / TRIGGER / API / PROVIDER or a generated map ({{concept}})',
            built: "`{{text}}…` builds a NIVO verb from text; name it through TOOL / TRIGGER / API / PROVIDER or a generated map ({{concept}})",
        },
    },
    create(context) {
        if (matchesAny(relOf(context), NOT_JUDGED)) return {}
        const report = (node, messageId, text) => context.report({ node, messageId, data: { text, concept: CONCEPT } })
        return {
            Literal(node) {
                if (typeof node.value === "string" && NIVO_VERB.test(node.value)) report(node, "typed", node.value)
            },
            TemplateLiteral(node) {
                const head = node.quasis[0]?.value.cooked ?? ""
                if (node.expressions.length === 0) {
                    if (NIVO_VERB.test(head)) report(node, "typed", head)
                } else if (NIVO_VERB_HEAD.test(head)) report(node, "built", head)
            },
        }
    },
}
