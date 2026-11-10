import { MessageCard } from "@starci/grammar/common"
import { ChatMessageBubble } from "@/components/composites/ChatMessageBubble"
import { ChatSystemLine } from "@/components/composites/ChatSystemLine"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import { ChannelAvatar } from "@/components/leaves/ChannelAvatar"
import type { InboxAgentView, InboxJourneyEntryView } from "@/modules/types"

/** Props for {@link InboxJourneyEntry}. */
export interface InboxJourneyEntryProps {
    readonly entry: InboxJourneyEntryView
    /** The customer's name and id: the avatar of their bubbles. */
    readonly customer: { readonly id: string; readonly name: string }
    /** The agent that owns the customer, for the mark of its cards; null when none. */
    readonly agent: InboxAgentView | null
}

/**
 * One entry of the journey, drawn as the team chat draws the same thing: the customer's words as an incoming bubble with the badge of the
 * channel on the avatar, what the shop said back as an outgoing bubble named for the agent, what an agent did as a card, and an order or a
 * payment as a small centred line.
 */
export const InboxJourneyEntry = (props: InboxJourneyEntryProps) => {
    const { entry, customer, agent } = props
    if (entry.kind === "milestone") return <ChatSystemLine text={`${entry.text} · ${entry.time}`} />
    if (entry.kind === "customer") {
        return (
            <ChatMessageBubble
                id={`journey-${entry.id}`}
                side="incoming"
                author={entry.who}
                avatar={
                    <ChannelAvatar
                        name={customer.name}
                        seed={customer.id}
                        badge={entry.channelBadge}
                        channelLabel={entry.channelLabel}
                        size="sm"
                    />
                }
                meta={entry.time}
                body={entry.text}
            />
        )
    }
    if (entry.kind === "reply") {
        return (
            <ChatMessageBubble
                id={`journey-${entry.id}`}
                side="outgoing"
                tone="soft"
                author={entry.who}
                meta={entry.time}
                body={entry.text}
            />
        )
    }
    return (
        <MessageCard
            id={`journey-${entry.id}`}
            title={entry.text}
            meta={`${entry.who} · ${entry.time}`}
            {...(agent !== null && agent.name === entry.who
                ? {
                      avatar: (
                          <ChatPartyMark
                              size="sm"
                              mark={{ kind: "agent", id: agent.id, name: agent.name, picture: agent.avatarUrl }}
                          />
                      ),
                  }
                : {})}
        />
    )
}
