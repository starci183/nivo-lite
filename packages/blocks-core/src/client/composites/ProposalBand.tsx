import type { ReactNode } from "react"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { conversationBlock } from "../../blocks/conversation.block"
import { proposalOf } from "../../rows/conversation-head"
import type { RenderOf } from "../render-props"
import { ConversationProposal } from "./ConversationProposal"
import type { ProposalInput } from "./ConversationProposal"
import { useBlockWords, useSlotLabels } from "./useBlockWords"

/** What the band of the proposed reply is given. */
export interface ProposalBandProps {
    readonly props: RenderOf<typeof conversationBlock>["props"]
    readonly slots: RenderOf<typeof conversationBlock>["slots"]
}

/** The reply an agent proposed for this thread, when the spec declares one and one waits: it collapses when nothing waits. */
export const ProposalBand = (band: ProposalBandProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const declared = band.props.proposal
    const { proposal, approve, edit, reject } = band.slots
    const fail = (): void => host.notify("danger", words({ key: "conversationActionFailed" }))
    if (declared === undefined) return null
    const run = (action: ActionHandle, input: ProposalInput): void => {
        action
            .run(input)
            .then((outcome) => {
                if (!outcome.ok) fail()
            })
            .catch(fail)
    }
    return (
        <SlotView
            slot={proposal.slot}
            labels={labels}
            placeholder={{}}
            forbidden="hide"
            empty="collapse"
            onRetry={proposal.retry}
            render={(record) => {
                const row = proposalOf(record, declared)
                return row === null ? null : (
                    <ConversationProposal
                        proposal={row}
                        words={{
                            title: words(declared.title),
                            moreLabel: words({ key: "conversationProposalMore" }),
                            saveLabel: words(declared.saveLabel),
                            cancelLabel: words(declared.cancelLabel),
                        }}
                        actions={{ approve, edit, reject }}
                        onRun={run}
                    />
                )
            }}
        />
    )
}
