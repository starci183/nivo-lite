import type { MessageFact } from "./agent-message-kinds"
import type { AgentMessageIntent, AgentMessageRecord } from "./agent-message-item"

/** The facts of a message as a card shows them: the worded ones a person reads, and the raw ones folded under the technical details. */
export interface MessageFactGroups {
    /** Facts with a plain label and a readable value, in the order given. */
    readonly worded: ReadonlyArray<MessageFact & { readonly id: string }>
    /** Facts holding a raw value (a code, an id, the raw words of an error), in the order given. */
    readonly technical: ReadonlyArray<MessageFact & { readonly id: string }>
}

/** The facts split into the worded and the technical ones, each with a stable row id (its place in the list). */
export const messageFactGroupsOf = (facts: ReadonlyArray<MessageFact>): MessageFactGroups => {
    const keyed = facts.map((fact, index) => ({ ...fact, id: `${String(index)}:${fact.name}` }))
    return {
        worded: keyed.filter((fact) => fact.technical !== true),
        technical: keyed.filter((fact) => fact.technical === true),
    }
}

/** The intents whose `message.text` is content a person approves before it goes out, so the card sets it apart as a quote. */
const PROPOSING: ReadonlySet<AgentMessageIntent> = new Set(["ask", "approve"])

/**
 * Whether the text of a `message.text` is a proposal (words the agent wants to send, set apart as a quote) rather than the agent's own
 * words to the team (a notice or a report, drawn as the card's plain body).
 */
export const isProposedText = (record: Pick<AgentMessageRecord, "intent" | "outbound">): boolean =>
    record.outbound !== undefined || PROPOSING.has(record.intent)
