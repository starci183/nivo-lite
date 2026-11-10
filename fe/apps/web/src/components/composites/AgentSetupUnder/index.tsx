import { SetupWriteCard } from "@/components/branches/SetupWriteCard"
import { AgentSetupProposalCard } from "@/components/branches/AgentSetupProposalCard"
import type { AgentSetupChatContent, AgentSetupCopy, SetupWriteDecision } from "@/modules/types"

/** What the cards under a reply can do: settle a confirm card, confirm or edit a proposed item. */
interface AgentSetupUnderCommands {
    readonly decide: (id: string, change: SetupWriteDecision) => void
    readonly gate: (gateKey: string, action: "confirm" | "edit", evidence?: string) => void
}

/** The message whose cards are drawn, the chat content, the words and the commands. */
interface AgentSetupUnderProps {
    readonly messageId: string
    readonly content: AgentSetupChatContent
    readonly copy: AgentSetupCopy
    readonly on: AgentSetupUnderCommands
}

/** The ids of the messages that have cards under them: the replies with confirm cards, and the newest reply for the proposals. */
export const underIdsOf = (content: AgentSetupChatContent): ReadonlyArray<string> => [
    ...new Set([...Object.keys(content.writes), ...(content.latestReplyId === "" ? [] : [content.latestReplyId])]),
]

/**
 * What stands under one reply of NIVO in the shared thread: the confirm cards of the facts it wants to write and, under the newest
 * reply, the items it proposed as the shared message cards ("Apply" confirms, "Edit" changes the words first).
 */
export const AgentSetupUnder = (props: AgentSetupUnderProps) => {
    const { content, copy, messageId } = props
    return (
        <>
            {(content.writes[messageId] ?? []).map((card) => (
                <SetupWriteCard
                    key={card.id}
                    write={card}
                    words={content.words}
                    isBusy={content.decidingId === card.id}
                    onDecide={props.on.decide}
                    instance={content.instance}
                />
            ))}
            {messageId === content.latestReplyId
                ? content.proposals.map((proposal) => (
                      <AgentSetupProposalCard
                          key={proposal.key}
                          proposal={proposal}
                          copy={copy}
                          isBusy={content.isSending}
                          on={props.on}
                      />
                  ))
                : null}
        </>
    )
}
