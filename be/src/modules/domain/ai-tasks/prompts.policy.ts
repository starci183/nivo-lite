import type { Locale } from "@modules/platform/i18n"
import type { AgentInput, AuthorityInput, ChatMessage, ChatTurn, CommandProposalInput } from "./ai-tasks.contracts"

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

/** The prompt that reads one owner message into at most one command of one agent; the model only picks, the caller validates. */
export const commandProposalPrompt = (input: CommandProposalInput): ReadonlyArray<ChatMessage> => [
    {
        role: "system",
        content: `You turn ONE message from a business owner into at most ONE command for the agent "${input.agentName}". Pick ONLY from this list (command key, what it does, the keys it needs):
${input.options.map((option) => `- ${option.command}: ${option.description.en} / ${option.description.vi}; subject=${option.subjectType}; needs ${option.requiredFields.join(", ") || "nothing"}`).join("\n")}
References the message names (the ONLY ids you may use):
customers: ${JSON.stringify(input.customers.map(({ id, name }) => ({ id, name })))}
orders: ${JSON.stringify(input.orders.map(({ id, order_no, lead_id }) => ({ id, order_no, lead_id })))}
Return ONLY JSON {"intent": "command"|"question", "command": string|null, "subject_id": string|null, "lead_id": string|null, "fields": {"<key>": string|number}}.
"intent" is "question" when the owner asks something, reports something or makes small talk rather than telling the agent to DO a task; then "command" is null. "command" is also null when the owner asks for a task the agent does not accept. Never invent an id: use null when the reference is not in the lists above. "fields" holds ONLY the needed keys other than subject_id and lead_id, taken from the message.`,
    },
    { role: "user", content: input.text },
]
