import type { Locale } from "@modules/platform/i18n"
import type { AgentInput, AuthorityInput, ChatMessage, ChatTurn } from "./deepseek.contracts"

/** The authority or nothing. */
export type OptionalAuthorityInput = AuthorityInput | null

/** The preamble every NIVO prompt starts with. */
export const NIVO =
    "You work inside NIVO OS, a responsibility operating system for founder-led service SMEs in Vietnam. " +
    "Every piece of work has one accountable owner, one explicit next action, and evidence of its outcome. " +
    "Act within the authority the owner granted; ask when data is missing, the action is over the limit, or the outcome is unclear. " +
    "Be concise, concrete and professional."

/** The language instruction of a prompt, following the reader's VI | EN switch. */
export const langFor = (locale: Locale): string =>
    locale === "vi" ? " Write in Vietnamese (natural business Vietnamese)." : " Write in English."

/** The owner's granted authority as a prompt section (policies, reply style, brand voice, limits). Empty when nothing is set. */
export const authorityBrief = (authority: OptionalAuthorityInput): string => {
    if (authority === null) return ""
    const lines = [
        authority.policies.trim() !== "" ? `Business policies:\n${authority.policies.trim()}` : "",
        authority.reply_style.trim() !== "" ? `Reply style: ${authority.reply_style.trim()}` : "",
        authority.brand_voice.trim() !== "" ? `Brand voice: ${authority.brand_voice.trim()}` : "",
        authority.limits_note.trim() !== "" ? `Always ask the owner first when: ${authority.limits_note.trim()}` : "",
    ].filter((line) => line !== "")
    return lines.length > 0 ? `\nAuthority granted by the owner:\n${lines.join("\n")}` : ""
}

/** The persona section of an agent prompt. */
export const personaOf = (agent: AgentInput, brief: string): string =>
    `You are ${agent.name} (@${agent.handle}), role: ${agent.role}.
Instructions: ${agent.instructions}
Business knowledge: ${agent.knowledge === undefined || agent.knowledge === "" ? "(none)" : agent.knowledge}
Approval rule: ${agent.approval_rule === undefined || agent.approval_rule === "" ? "Commitments need human approval." : agent.approval_rule}${brief}`

/** A chat as prompt messages: the customer speaks as the user, the agent as the assistant. */
export const toMessages = (turns: ReadonlyArray<ChatTurn>): ReadonlyArray<ChatMessage> =>
    turns.map((turn) => ({ role: turn.role === "user" ? "user" : "assistant", content: turn.body }))
