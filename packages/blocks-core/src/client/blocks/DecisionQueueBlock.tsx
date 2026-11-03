import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { decisionQueueBlock } from "../../blocks/decision-queue.block"
import { parsedSlot, rowsSlot } from "../../slots/slots"
import { DECISION_QUEUE_PLACEHOLDER } from "../../views/placeholders"
import { decisionQueueView } from "../../views/views"
import { DecisionList } from "../composites/DecisionList"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The decisions waiting for a person, each decided in place; as a card it collapses while nothing waits. */
export const DecisionQueueBlock = (props: RenderOf<typeof decisionQueueBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.emptyTitle)
    const read = props.slots.queue
    const command = props.slots.command
    const runCommand = (rowId: string, commandId: string): void => {
        if (!command.isAllowed) return
        command
            .run({ id: rowId, command: commandId })
            .then((outcome) => {
                if (!outcome.ok) host.notify("danger", labels.error)
            })
            .catch(() => host.notify("danger", labels.error))
    }
    return (
        <SlotView
            slot={rowsSlot(parsedSlot(read.slot, decisionQueueView))}
            labels={labels}
            placeholder={DECISION_QUEUE_PLACEHOLDER}
            forbidden="hide"
            empty={props.props.surface === "card" ? "collapse" : "notice"}
            emptyDescription={words(props.props.emptyBody)}
            onRetry={read.retry}
            render={(queue, isLoading) => (
                <DecisionList
                    surface={props.props.surface}
                    queue={queue}
                    isLoading={isLoading}
                    onCommand={runCommand}
                    words={{
                        label: words(props.props.label),
                        emptyTitle: words(props.props.emptyTitle),
                        emptyBody: words(props.props.emptyBody),
                        seeWhyLabel: words(props.props.seeWhy),
                        moreLabel: words(props.props.moreMenu),
                    }}
                />
            )}
        />
    )
}
