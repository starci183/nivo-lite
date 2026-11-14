import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import type { agentMessageBlock } from "../../blocks/agent-message.block"
import { agentMessageKinds } from "../../agent-message/module-agent-message-kinds"
import { agentMessageItemOf } from "../../agent-message/agent-message-item"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"
import { AgentMessageCard } from "./AgentMessageCard"
import { agentMessageViews } from "./module-agent-message-views"
import { messageWordsOf } from "./agent-message-block-words"

type BlockProps = RenderOf<typeof agentMessageBlock>

/** What an action on a message is given: the message and, as the action calls for it, the edited values or the option picked. */
interface MessageActionInput {
    readonly id: string
    readonly values?: Readonly<Record<string, string>>
    readonly option?: string
}

/** The agent message of the slot, drawn as the shared card; it holds no business, the verdicts and answers are the bound actions. */
export const AgentMessageBlock = (props: BlockProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.message
    const { approve, reject, reply } = props.slots
    const wordsOf = messageWordsOf(words)
    const fail = (): void => host.notify("danger", words({ key: "agentMessageActionFailed" }))
    const run = (action: ActionHandle, input: MessageActionInput): void => {
        action
            .run(input)
            .then((outcome) => {
                if (!outcome.ok) fail()
            })
            .catch(fail)
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
                const item = agentMessageItemOf(record, agentMessageKinds)
                if (item === null) return null
                const id = item.record.id
                return (
                    <AgentMessageCard
                        item={item}
                        views={agentMessageViews}
                        words={wordsOf}
                        maxLength={props.props.maxLength}
                        canApprove={approve.isAllowed}
                        canReject={reject.isAllowed}
                        canReply={reply.isAllowed}
                        isRunning={approve.isRunning || reject.isRunning || reply.isRunning}
                        onApprove={(values) => run(approve, values === null ? { id } : { id, values })}
                        onReject={() => run(reject, { id })}
                        onReply={(option) => run(reply, { id, option })}
                    />
                )
            }}
        />
    )
}
