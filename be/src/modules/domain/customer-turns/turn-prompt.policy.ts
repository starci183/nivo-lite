import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { TranscriptLine } from "@modules/domain/agent-messages"
import type { CustomerChannel } from "./customer-turns.contracts"

/** How many earlier messages a turn carries. */
const HISTORY_TURNS = 20
/** The inbound channel keys a customer conversation may come in on. */
const CHANNEL_KEYS: ReadonlyArray<CustomerChannel["key"]> = ["telegram", "facebook", "instagram", "zalo"]

/** What the system part of a customer turn is made of. */
export interface TurnSystemParts {
    /** The persona: name, role, the owner's instructions and notes, the approval rule. */
    readonly persona: string
    /** The owner's granted authority, as a prompt section (may be empty). */
    readonly authority: string
    /** Blocks other capabilities add for this turn (open jobs...), each possibly empty. */
    readonly extras: ReadonlyArray<string>
    /** The reply contract. */
    readonly contract: string
}

/** The name the agent answers under: its own with its handle, or the front agent's name alone after a hand-over. */
const nameLineOf = (agent: TurnConversation["agent"], speaksAs: TurnConversation["speaksAs"]): string =>
    speaksAs === null ? agent.name + " (@" + agent.handle + ")" : speaksAs

/**
 * The persona section of a customer-facing agent. After a hand-over the speaker keeps its own role and instructions but answers under
 * the name of the agent that opened the door (`speaksAs`), so the customer sees one name; the handle then stays out.
 */
export const personaOf = (agent: TurnConversation["agent"], speaksAs: TurnConversation["speaksAs"]): string =>
    `You are ${nameLineOf(agent, speaksAs)}, role: ${agent.role}.
Instructions: ${agent.instructions}
Business knowledge: ${agent.knowledge.trim() === "" ? "(none)" : agent.knowledge}
Approval rule: ${agent.approvalRule.trim() === "" ? "Commitments need human approval." : agent.approvalRule}`

/** The authoritative system context of one customer turn: the PUBLIC, owner-approved view of the business and the reply contract. */
export const turnSystemOf = (parts: TurnSystemParts): string =>
    [
        "You work inside NIVO OS, a responsibility operating system for founder-led service SMEs in Vietnam. Act within the authority the owner granted; ask when data is missing, the action is over the limit, or the outcome is unclear.",
        `${parts.persona}${parts.authority}`,
        ...parts.extras,
        parts.contract,
        "Answer with ONLY the JSON object of the reply contract.",
    ]
        .filter((part) => part.trim() !== "")
        .join("\n\n")

/**
 * The text sent into the OpenClaw thread. The transcript is included every turn (the thread may be new), and the context is
 * authoritative: it is the public, owner-approved view of the business.
 */
export const turnMessageOf = (system: string, transcript: ReadonlyArray<TranscriptLine>, latest: string): string => {
    const earlier = transcript
        .slice(-HISTORY_TURNS)
        .slice(0, -1)
        .map((line) => `${line.role === "user" ? "Customer" : "You"}: ${line.body}`)
        .join("\n")
    return [
        "[NIVO CONTEXT: authoritative; follow it exactly]",
        system,
        "",
        "[CONVERSATION SO FAR]",
        earlier === "" ? "(this is the first message)" : earlier,
        "",
        "[CUSTOMER LATEST MESSAGE]",
        latest,
    ].join("\n")
}

/** The inbound channel key of a conversation channel; anything else is the website chat. */
export const channelKeyOf = (channel: string): CustomerChannel["key"] =>
    CHANNEL_KEYS.find((key) => key === channel) ?? "website"
