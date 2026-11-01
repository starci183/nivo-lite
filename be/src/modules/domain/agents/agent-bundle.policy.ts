import type {
    AgentPersona,
    AgentsMdInput,
    BaseRuleText,
    OptionalContextVersionText,
    TextOf,
    ToolListing,
} from "./agents.contracts"
import type { BaseRule, ContextVersion } from "./agents.port"

/** Base rules go into every prompt of every turn: keep them to a budget (the full text stays in NIVO). */
export const RULES_BUDGET = 5200
const RULE_MAX = 900

const SETUP_START = "### NIVO setup"
const SETUP_END = "### end NIVO setup"
const WHITESPACE = /\s/u

/** The text without markdown headings and bold marks. */
export const stripMarkdown = (text: string): string =>
    text
        .replace(/^#{1,6}\s*/gmu, "")
        .replaceAll("**", "")
        .trim()

/** The text cut to `max` characters at a word boundary, with " ..." when it was cut. */
export const trimTo = (text: string, max: number): string => {
    if (text.length <= max) return text
    const prefix = text.slice(0, max)
    let end = prefix.length
    while (end > 0 && !WHITESPACE.test(prefix.charAt(end - 1))) end -= 1
    if (end === 0) return `${prefix} ...`
    while (end > 0 && WHITESPACE.test(prefix.charAt(end - 1))) end -= 1
    return `${prefix.slice(0, end)} ...`
}

/** The text without the block the setup chat appended, trimmed. */
export const withoutSetupBlock = (text: string): string => {
    const parts: Array<string> = []
    let at = 0
    let start = text.indexOf(SETUP_START, at)
    while (start !== -1) {
        const end = text.indexOf(SETUP_END, start + SETUP_START.length)
        if (end === -1) break
        let before = start
        while (before > at && text[before - 1] === "\n") before -= 1
        parts.push(text.slice(at, before))
        at = end + SETUP_END.length
        while (WHITESPACE.test(text[at] ?? "")) at += 1
        start = text.indexOf(SETUP_START, at)
    }
    parts.push(text.slice(at))
    return parts.join("").trim()
}

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

/** The knowledge an agent may read, by title only: the text is read through NIVO MCP, where rights are checked and audited. */
const knowledgeBlockOf = (input: AgentsMdInput, t: TextOf): string => {
    if (input.sources.length === 0) return t("bundle.knowledgeNone")
    const body = t("bundle.knowledgeIndex", { titles: input.sources.map((source) => source.title).join("; ") })
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
