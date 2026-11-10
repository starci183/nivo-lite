import type { ReactNode } from "react"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { approvalCardBlock } from "../../blocks/chatbot/approval-card.block"
import { PROPOSAL_FIELDS } from "../../rows/chatbot/inbox-fields"
import { proposalOf } from "../../rows/chatbot/proposal"
import type { ProposalRow } from "../../rows/chatbot/conversation.types"
import { agentMessageKinds } from "../../agent-message/module-agent-message-kinds"
import { agentMessageItemOf, type AgentMessageItem } from "../../agent-message/agent-message-item"
import { AgentMessageCard, type AgentMessageWords } from "../agent-message/AgentMessageCard"
import { agentMessageViews } from "../agent-message/module-agent-message-views"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

type CardProps = RenderOf<typeof approvalCardBlock>

/** What an action on a draft is given: the draft and, when the person changed it, the new words. */
interface DraftRunInput {
    readonly id: string
    readonly values?: { readonly text: string }
}

/** The words of the states and of the kinds' bodies: a drafted reply waits, so none is drawn. */
const NO_OUTCOME_WORDS: Pick<AgentMessageWords, "kinds" | "states"> = {
    kinds: { total: "", customer: "", deliver: "", openConnections: "" },
    states: { waiting: "", approved: "", sent: "", rejected: "", failed: "", expired: "" },
}

/** A drafted reply as the generic approval item it is: a text, waiting, with the customer's question as its evidence. */
const itemOf = (proposal: ProposalRow, title: string, note: string, askedPrefix: string): AgentMessageItem | null =>
    agentMessageItemOf(
        {
            id: proposal.id,
            kind: "message.text",
            intent: "approve",
            state: "waiting",
            title,
            payload: { text: proposal.text },
            note,
            why:
                proposal.asked === ""
                    ? []
                    : [{ source: "evidence", label: `${askedPrefix}${proposal.asked}`, quote: "" }],
        },
        agentMessageKinds,
    )

/**
 * The approval card of the Chatbot thread: the reply the AI drafted, waiting for a person, drawn by the shared approval card. It draws
 * nothing while no draft waits and holds no business: approving is the bound action, which posts the line and queues its delivery.
 */
export const ApprovalCardBlock = (props: CardProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.proposal
    const { approve, dismiss } = props.slots
    const fail = (): void => host.notify("danger", words({ key: "approval_failed" }))
    const run = (action: ActionHandle, input: DraftRunInput): void => {
        action
            .run(input)
            .then((outcome) => {
                if (!outcome.ok) fail()
            })
            .catch(fail)
    }
    const wordsOf: AgentMessageWords = {
        approve: approve.label,
        edit: words({ key: "approval_edit" }),
        reject: dismiss.label,
        sendEdited: words({ key: "approval_send_edited" }),
        cancel: words({ key: "approval_cancel" }),
        why: "",
        evidence: "",
        rule: "",
        openDetail: "",
        openWork: "",
        from: "",
        to: "",
        via: "",
        outboundTo: "",
        editLabel: words({ key: "approval_title" }),
        ...NO_OUTCOME_WORDS,
    }
    return (
        <SlotView
            slot={read.slot}
            labels={labels}
            placeholder={{}}
            forbidden="hide"
            empty="collapse"
            onRetry={read.retry}
            render={(record) => {
                const proposal = proposalOf(record, PROPOSAL_FIELDS)
                const note = proposal === null || proposal.note === "" ? words({ key: "approval_note" }) : proposal.note
                const item =
                    proposal === null
                        ? null
                        : itemOf(
                              proposal,
                              words({ key: "approval_title" }),
                              note,
                              words({ key: "approval_asked_prefix" }),
                          )
                if (proposal === null || item === null) return null
                return (
                    <AgentMessageCard
                        item={item}
                        views={agentMessageViews}
                        words={wordsOf}
                        maxLength={props.props.maxLength}
                        canApprove={approve.isAllowed}
                        canReject={dismiss.isAllowed}
                        canReply={false}
                        isRunning={approve.isRunning || dismiss.isRunning}
                        onApprove={(values) =>
                            run(
                                approve,
                                values === null
                                    ? { id: proposal.id }
                                    : { id: proposal.id, values: { text: values["text"] ?? "" } },
                            )
                        }
                        onReject={() => run(dismiss, { id: proposal.id })}
                        onReply={() => undefined}
                    />
                )
            }}
        />
    )
}
