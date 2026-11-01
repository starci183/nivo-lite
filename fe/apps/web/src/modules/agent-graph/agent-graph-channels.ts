import type { AgentGraphNodeData } from "@/modules/types"

/** The tools of a node that are a channel to customers: the card says whether the agent has one, instead of naming a channel it is not on. */
const CHANNEL_USES: ReadonlySet<string> = new Set(["telegram", "zalo"])

/** What the card line of a node needs to tell the truth about channels. */
export interface ChannelWords {
    /** The names of the channels the agent is connected to; empty when none. */
    readonly connected: ReadonlyArray<string>
    /** The line for an agent with no channel: "No channel connected". */
    readonly none: string
}

/**
 * The line under the title of a node. A node whose first tool is a channel (Telegram, Zalo) names the channels the agent is on, or
 * says it has none, so the map never shows a channel the header of the same agent denies. Any other line stays as the back end wrote it.
 */
export const cardLineWithChannels = (node: AgentGraphNodeData, channels: ChannelWords): string => {
    const [first, ...rest] = node.card.description.split(" · ")
    if (first === undefined || !CHANNEL_USES.has(first.toLowerCase())) return node.card.description
    const lead = channels.connected.length === 0 ? channels.none : channels.connected.join(", ")
    return [lead, ...rest].join(" · ")
}
