import { messageTextKind } from "@nivo-lite/agent-sdk/team-chat"
import { AgentMessageCard, agentMessageViews, type AgentMessageWords } from "@/modules/plugin-registry/client"
import { agentMessageItemOf, agentMessageKinds } from "@/modules/plugin-registry"
import type { AgentSetupCopy, AgentSetupProposal } from "@/modules/types"

/** What the owner can do with a proposal: apply it as it stands, or apply it with the words changed. */
interface AgentSetupProposalCommands {
    readonly gate: (gateKey: string, action: "confirm" | "edit", evidence?: string) => void
}

/** A proposal, the words, and whether its answer is in flight. */
interface AgentSetupProposalCardProps {
    readonly proposal: AgentSetupProposal
    readonly copy: AgentSetupCopy
    readonly isBusy: boolean
    readonly on: AgentSetupProposalCommands
}

/** The words of the shared agent message card, from the words of the setup. */
const wordsOf = (copy: AgentSetupCopy): AgentMessageWords => ({
    approve: copy.applyLabel,
    edit: copy.proposalEditLabel,
    reject: "",
    sendEdited: copy.applyLabel,
    cancel: copy.cancelLabel,
    why: "",
    evidence: "",
    rule: "",
    openDetail: "",
    openWork: "",
    from: copy.proposalFrom,
    to: "",
    via: "",
    outboundTo: "",
    editLabel: copy.proposalEditLabel,
    kinds: { total: "", customer: "", deliver: "", openConnections: "" },
    states: {
        waiting: copy.proposedLabel,
        approved: copy.confirmedLabel,
        sent: copy.confirmedLabel,
        rejected: "",
        failed: "",
        expired: "",
    },
})

/**
 * A proposal of NIVO in the setup chat, drawn by the one agent message card of the app (the same card as the team chat): an approval
 * whose "Apply" confirms the item and whose edit changes the words before they are applied.
 */
export const AgentSetupProposalCard = (props: AgentSetupProposalCardProps) => {
    const { proposal } = props
    const item = agentMessageItemOf(
        {
            id: proposal.key,
            kind: messageTextKind.id,
            intent: "approve",
            state: "waiting",
            agent: "NIVO",
            title: proposal.title,
            summary: proposal.evidence,
            payload: { text: proposal.evidence },
        },
        agentMessageKinds,
    )
    if (item === null) return null
    return (
        <AgentMessageCard
            item={item}
            views={agentMessageViews}
            words={wordsOf(props.copy)}
            maxLength={4000}
            canApprove
            canReject={false}
            canReply={false}
            isRunning={props.isBusy}
            onApprove={(values) =>
                values === null
                    ? props.on.gate(proposal.key, "confirm")
                    : props.on.gate(proposal.key, "edit", values["text"] ?? proposal.evidence)
            }
            onReject={() => undefined}
            onReply={() => undefined}
        />
    )
}
