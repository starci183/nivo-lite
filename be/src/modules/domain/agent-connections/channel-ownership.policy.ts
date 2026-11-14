import type { ChannelClaim, ChannelHolder, OptionalChannelOwner, Purpose } from "./agent-connections.contracts"

/**
 * The purposes by which an agent speaks with customers on a channel connection: it answers inbound chat, writes outbound on it, or
 * takes its leads. A bank feed, a data source or a tool is shared freely and has no owner.
 */
export const CHANNEL_PURPOSES: ReadonlyArray<Purpose> = ["inbound_chat", "outbound_chat", "lead_source"]

/** Whether a stored purpose is one by which an agent speaks on a channel. */
export const isChannelPurpose = (purpose: string): boolean => {
    const purposes: ReadonlyArray<string> = CHANNEL_PURPOSES
    return purposes.includes(purpose)
}

/** Whether a binding makes its agent answer the channel: a channel purpose. What it may do there lives in its attachment's rights. */
export const answersChannel = (purpose: string): boolean => isChannelPurpose(purpose)

/** Oldest grant first, then the agent id, so the same holders always give the same owner. */
const byGrantedAt = (left: ChannelHolder, right: ChannelHolder): number =>
    left.grantedAt.getTime() - right.grantedAt.getTime() || left.agentId.localeCompare(right.agentId)

/**
 * THE OWNERSHIP RULE: each channel connection is answered by exactly one agent of a role. Among the agents of the module that answer
 * the connection, the one granted first owns it; the others (only possible from data older than the rule) never answer.
 */
export const channelOwnerOf = (holders: ReadonlyArray<ChannelHolder>, module: string): OptionalChannelOwner =>
    [...holders]
        .filter((holder) => holder.module === module && answersChannel(holder.purpose))
        .sort(byGrantedAt)[0] ?? null

/** The purpose by which an agent is the front door of a connection: its customers' messages wake it. */
const INBOUND: Purpose = "inbound_chat"

/**
 * THE FRONT-DOOR RULE: a channel connection (one stream of customer messages) has exactly ONE inbound agent, whatever its role, so one
 * event starts one run. The holder is the agent granted inbound first.
 */
export const frontDoorOf = (holders: ReadonlyArray<ChannelHolder>): OptionalChannelOwner =>
    [...holders].filter((holder) => holder.purpose === INBOUND).sort(byGrantedAt)[0] ?? null

/**
 * The agent that already answers the connection in a way the claim would double: null when the claim does not answer the channel (its
 * purpose is no channel purpose) or the holder is the claiming agent itself. An inbound claim meets the connection's front door of ANY
 * role (a second front door on one stream is refused); any other channel claim meets the owner of its own role.
 */
export const ownershipConflictOf = (
    holders: ReadonlyArray<ChannelHolder>,
    claim: ChannelClaim,
): OptionalChannelOwner => {
    if (!answersChannel(claim.purpose)) return null
    const others = holders.filter((holder) => holder.agentId !== claim.agentId)
    if (claim.purpose === INBOUND) {
        const front = frontDoorOf(others)
        if (front !== null) return front
    }
    return channelOwnerOf(others, claim.module)
}

/** The owner of each connection for one role, one entry per connection that has one, in the order the connections first appear. */
export const ownersByConnection = (
    holders: ReadonlyArray<ChannelHolder>,
    module: string,
): ReadonlyArray<ChannelHolder> => {
    const connectionIds = [...new Set(holders.map((holder) => holder.connectionId))]
    return connectionIds.flatMap((connectionId) => {
        const owner = channelOwnerOf(
            holders.filter((holder) => holder.connectionId === connectionId),
            module,
        )
        return owner === null ? [] : [owner]
    })
}
