import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { decisionQueueBlock } from "../../blocks/decision-queue.block"
import { cellContextOf } from "../../rows/cell-format"
import { declaredQueue, EDIT_COMMAND, editAnswerOf, editFailure } from "../../rows/decision-commands"
import type { EditAnswer } from "../../rows/decision-commands"
import type { FormValues } from "../../rows/form-values"
import { parsedSlot, derivedSlot } from "../../slots/slots"
import { DECISION_QUEUE_PLACEHOLDER } from "../../views/placeholders"
import { decisionQueueView } from "../../views/views"
import type { DecisionQueueView } from "../../views/views.types"
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
    const spec = props.props
    const runCommand = (rowId: string, commandId: string): void => {
        if (!command.isAllowed) return
        command
            .run({ id: rowId, command: commandId })
            .then((outcome) => {
                if (!outcome.ok) host.notify("danger", labels.error)
            })
            .catch(() => host.notify("danger", labels.error))
    }
    const sendEdit = (rowId: string, values: FormValues): Promise<EditAnswer> =>
        command
            .run({ id: rowId, command: EDIT_COMMAND, values })
            .then(editAnswerOf)
            .catch(() => editFailure)
    const edit =
        spec.edit === undefined || !command.isAllowed
            ? null
            : {
                  fields: spec.edit.fields,
                  currency: cellContextOf(host.locale(), spec.currency).currency,
                  words: {
                      label: words(spec.edit.label),
                      submit: words(spec.edit.submitLabel),
                      cancel: words(spec.edit.cancelLabel),
                      text: words,
                  },
                  onSend: sendEdit,
              }
    const queue = derivedSlot(parsedSlot(read.slot, decisionQueueView), (view: DecisionQueueView) =>
        view.rows.length === 0 ? null : declaredQueue(view, spec.commands ?? [], spec.edit?.label, words),
    )
    return (
        <SlotView
            slot={queue}
            labels={labels}
            placeholder={DECISION_QUEUE_PLACEHOLDER}
            forbidden="hide"
            empty={spec.surface === "card" ? "collapse" : "notice"}
            emptyDescription={words(spec.emptyBody)}
            onRetry={read.retry}
            render={(view, isLoading) => (
                <DecisionList
                    surface={spec.surface}
                    queue={view}
                    isLoading={isLoading}
                    edit={edit}
                    onCommand={runCommand}
                    words={{
                        label: words(spec.label),
                        emptyTitle: words(spec.emptyTitle),
                        emptyBody: words(spec.emptyBody),
                        seeWhyLabel: words(spec.seeWhy),
                        moreLabel: words(spec.moreMenu),
                    }}
                />
            )}
        />
    )
}
