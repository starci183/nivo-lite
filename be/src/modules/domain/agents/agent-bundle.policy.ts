import type {
    AgentPersona,
    AgentsMdInput,
    BaseRuleText,
    BundleFile,
    OptionalContextVersionText,
    TextOf,
    ToolListing,
} from "./agents.contracts"
import type { BaseRule, ContextVersion, KnowledgeDocument } from "./agents.port"

/** Base rules go into every prompt of every turn: keep them to a budget (the full text stays in NIVO). */
export const RULES_BUDGET = 5200
const RULE_MAX = 900

/** Public knowledge is inlined only while it is small; the rest is in knowledge/ and in the per-turn passages. */
export const INLINE_KNOWLEDGE_MAX = 6000

const SLUG_MAX = 48
const SETUP_BLOCK = /\n*### NIVO setup[\s\S]*?### end NIVO setup\s*/gu

/** The file name part of a title: ASCII lower case words joined by dashes. */
export const slugOf = (title: string): string => {
    const slug = title
        .normalize("NFD")
        .replace(/[̀-ͯ]/gu, "")
        .replace(/đ/giu, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-+|-+$/gu, "")
        .slice(0, SLUG_MAX)
    return slug === "" ? "source" : slug
}

/** The text without markdown headings and bold marks. */
export const stripMarkdown = (text: string): string =>
    text
        .replace(/^#{1,6}\s*/gmu, "")
        .replace(/\*\*/gu, "")
        .trim()

/** The text cut to `max` characters at a word boundary, with " ..." when it was cut. */
export const trimTo = (text: string, max: number): string =>
    text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/u, "")} ...`

/** The text without the block the setup chat appended, trimmed. */
export const withoutSetupBlock = (text: string): string => text.replace(SETUP_BLOCK, "").trim()

/** The base rules cut to their budget, in order, until the budget is spent. */
export const budgetRules = (rules: ReadonlyArray<BaseRule>): ReadonlyArray<BaseRuleText> =>
    rules.reduce<{ readonly left: number; readonly out: ReadonlyArray<BaseRuleText> }>(
        (state, rule) => {
            if (state.left <= 0) return state
            const text = trimTo(stripMarkdown(rule.body), Math.min(RULE_MAX, state.left))
            return { left: state.left - text.length, out: [...state.out, { title: rule.title, text }] }
        },
        { left: RULES_BUDGET, out: [] },
    ).out

/** The persona block of AGENTS.md. */
export const personaTextOf = (persona: AgentPersona, t: TextOf): string => {
    const instructions = withoutSetupBlock(persona.instructions)
    const notes = withoutSetupBlock(persona.knowledge ?? "")
    return [
        t("bundle.personaName", { name: persona.name, handle: persona.handle }),
        t("bundle.personaRole", { role: persona.role }),
        instructions === "" ? "" : t("bundle.personaInstructions", { text: instructions }),
        notes === "" ? "" : t("bundle.personaNotes", { text: notes }),
        t("bundle.personaApproval", { rule: persona.approvalRule ?? t("bundle.approvalDefault") }),
    ]
        .filter((line) => line !== "")
        .join("\n")
}

/** The active context version as text: summary, confirmed gate evidence and facts. */
export const contextTextOf = (version: ContextVersion, t: TextOf): string =>
    [
        version.summary.trim(),
        version.gates.length === 0 ? "" : version.gates.map((gate) => `- ${gate.label}: ${gate.evidence}`).join("\n"),
        version.facts.length === 0
            ? ""
            : t("bundle.contextFacts", { facts: version.facts.map((fact) => `- ${fact}`).join("\n") }),
    ]
        .filter((part) => part !== "")
        .join("\n\n")

/** The applied context ready for AGENTS.md, or null when none is applied. */
export const appliedContextOf = (version: ContextVersion | null, t: TextOf): OptionalContextVersionText =>
    version === null ? null : { version: version.version, text: contextTextOf(version, t) }

/** One knowledge file of the bundle. */
export const knowledgeFileOf = (index: number, document: KnowledgeDocument, t: TextOf): BundleFile => {
    const visibility = document.visibility === "public" ? "bundle.visibilityPublic" : "bundle.visibilityInternal"
    const topic = document.topic === null ? "" : t("bundle.fileTopic", { topic: document.topic })
    const meta = t("bundle.fileMeta", {
        kind: document.kind,
        visibility: t(visibility),
        date: document.updatedAt.slice(0, 10),
    })
    return {
        path: `knowledge/${String(index + 1).padStart(2, "0")}-${slugOf(document.title)}.md`,
        content: `# ${document.title}\n\n${topic}${meta}\n\n${document.content.trim()}\n`,
    }
}

const knowledgeBlockOf = (input: AgentsMdInput, t: TextOf): string => {
    if (input.sources.length === 0) return t("bundle.knowledgeNone")
    const total = input.sources.reduce((sum, source) => sum + source.content.length, 0)
    const body =
        total <= INLINE_KNOWLEDGE_MAX
            ? input.sources.map((source) => `### ${source.title}\n${source.content.trim()}`).join("\n\n")
            : t("bundle.knowledgeIndex", { titles: input.sources.map((source) => source.title).join("; ") })
    const audience = input.audience === "customer" ? "bundle.audienceCustomer" : "bundle.audienceInternal"
    return t("bundle.knowledgeSection", { audience: t(audience), body })
}

/** AGENTS.md: rules, context, persona, knowledge, tools and the reply contract, in the order the model must weigh them. */
export const agentsMdOf = (input: AgentsMdInput, t: TextOf): string => {
    return (
        [
            t("bundle.title", { name: input.name, module: input.module }),
            t("bundle.syncNote"),
            input.persona === null ? "" : t("bundle.roleSection", { persona: personaTextOf(input.persona, t) }),
            input.rules.length === 0
                ? ""
                : t("bundle.rulesSection", {
                      rules: input.rules.map((rule) => `### ${rule.title}\n${rule.text}`).join("\n\n"),
                  }),
            input.version === null
                ? t("bundle.contextNone")
                : t("bundle.contextSection", { version: input.version.version, text: input.version.text }),
            input.memory,
            knowledgeBlockOf(input, t),
            input.contract === null ? "" : t("bundle.contractSection", { contract: input.contract }),
            input.tools,
        ]
            .filter((section) => section !== "")
            .join("\n\n") + "\n"
    )
}

/** SOUL.md: the confirmed tone and the NIVO tone guidance. */
export const soulMdOf = (name: string, toneEvidence: string, tone: ReadonlyArray<BaseRule>, t: TextOf): string =>
    [
        t("bundle.soulTitle", { name }),
        toneEvidence === "" ? t("bundle.soulDefault") : t("bundle.soulConfirmed", { text: toneEvidence }),
        tone.length === 0
            ? ""
            : t("bundle.soulGuidance", {
                  text: tone
                      .map((rule) => `### ${rule.title}\n${trimTo(stripMarkdown(rule.body), RULE_MAX)}`)
                      .join("\n\n"),
              }),
    ]
        .filter((section) => section !== "")
        .join("\n\n") + "\n"

/** The part of AGENTS.md only this process knows: the tools of the bridge and how a turn calls them. */
export const toolsSectionOf = (manifest: ReadonlyArray<ToolListing>, t: TextOf): string =>
    [
        t("bundle.toolsTitle"),
        t("bundle.toolsIntro"),
        ...manifest.map((tool) =>
            t("bundle.toolLine", { name: tool.name, description: tool.description, args: JSON.stringify(tool.args) }),
        ),
    ].join("\n")
