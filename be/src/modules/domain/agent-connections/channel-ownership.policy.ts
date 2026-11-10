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

/** Whether a grant makes its agent answer the channel: a channel purpose with access to act (ask or auto), not only to read. */
export const answersChannel = (purpose: string, access: string): boolean =>
    isChannelPurpose(purpose) && (access === "ask" || access === "auto")

/** Oldest grant first, then the agent id, so the same holders always give the same owner. */
const byGrantedAt = (left: ChannelHolder, right: ChannelHolder): number =>
    left.grantedAt.getTime() - right.grantedAt.getTime() || left.agentId.localeCompare(right.agentId)

/**
 * THE OWNERSHIP RULE: each channel connection is answered by exactly one agent of a role. Among the agents of the module that answer
 * the connection, the one granted first owns it; the others (only possible from data older than the rule) never answer.
 */
export const channelOwnerOf = (holders: ReadonlyArray<ChannelHolder>, module: string): OptionalChannelOwner =>
    [...holders]
        .filter((holder) => holder.module === module && answersChannel(holder.purpose, holder.access))
        .sort(byGrantedAt)[0] ?? null

/**
 * The agent that already answers the connection for the role of a claim, when the claim would make a second one: null when the claim
 * does not answer the channel (it only reads, or its purpose is no channel purpose), or the role's owner is the claiming agent itself.
 */
export const ownershipConflictOf = (
    holders: ReadonlyArray<ChannelHolder>,
    claim: ChannelClaim,
): OptionalChannelOwner => {
    if (!answersChannel(claim.purpose, claim.access)) return null
    const owner = channelOwnerOf(
        holders.filter((holder) => holder.agentId !== claim.agentId),
        claim.module,
    )
    return owner
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
