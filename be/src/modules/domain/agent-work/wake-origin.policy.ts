import type { AgentWakeContext } from "./agent-work.contracts"

/** Where a wake came from, as the run trace names it: the road into the graph, whatever its trigger. */
export type WakeOrigin = "channel" | "person" | "agent" | "event" | "schedule"

/** The parts of a wake that say where it came from. */
export interface WakeOriginInput {
    /** The wake source. */
    readonly source: string
    /** The ids the wake carries. */
    readonly context: AgentWakeContext
    /** The member behind the wake, or null. */
    readonly actorMemberId: string | null
}

/**
 * Where a wake came from: a clock slot is a schedule, an internal event or a feed is an event, an agent named as the tagger is an agent, a person who wrote the tagging message
 * (a group thread or a chat) is a person, a customer message or a tag on a conversation with nobody behind it is the channel, and a tag
 * with neither is another agent's end node.
 */
export const wakeOriginOf = ({ source, context, actorMemberId }: WakeOriginInput): WakeOrigin => {
    if (source === "schedule") return "schedule"
    if (source === "internal") return "event"
    if (context.authorAgentId !== undefined) return "agent"
    if (context.tagSource !== undefined) return "event"
    if (actorMemberId !== null || context.authorUserId !== undefined) return "person"
    if (source === "customer" || context.conversationId !== undefined) return "channel"
    return "agent"
}
