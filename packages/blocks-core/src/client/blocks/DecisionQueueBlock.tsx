import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { SurfaceCard } from "@starci/grammar/common"
import type { decisionQueueBlock } from "../../blocks/decision-queue.block"
import { cellContextOf } from "../../rows/cell-format"
import {
    declaredQueue,
    editAnswerOf,
    editFailure,
    editInputOf,
    onePrimaryQueue,
    type EditAnswer,
} from "../../rows/decision-commands"
import type { FormValues } from "../../rows/form-values"
import { parsedSlot, derivedSlot } from "../../slots/slots"
import { DECISION_QUEUE_PLACEHOLDER } from "../../views/placeholders"
import { decisionQueueView } from "../../views/views"
import type { DecisionQueueView } from "../../views/views.types"
import { openOrdersView } from "../../rules/sales/ledger/open-orders"
import { amountOf, confirmWordsOf, pickWordsOf } from "../composites/queue-choice-words"
import { useQueueCommands } from "../composites/useQueueChoices"
import { QueueChoices } from "../composites/QueueChoices"
import { DecisionList } from "../composites/DecisionList"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** What the notice of the queue stands in. */
interface QueueFrameProps {
    readonly surface: RenderOf<typeof decisionQueueBlock>["props"]["surface"]
    readonly label: string
    readonly children: ReactNode
}

/** The place of the queue while it has nothing to list: its card with the notice inside, so the card never comes and goes; a section needs none. */
const QueueFrame = (props: QueueFrameProps): ReactNode =>
    props.surface === "card" ? (
        <SurfaceCard label={props.label} headingLevel={3}>
            {props.children}
        </SurfaceCard>
    ) : (
        props.children
    )

/** The queue with the words of where it is answered at the end of each row that offers no command; the queue itself when the spec says none. */
const answeredElsewhere = (queue: DecisionQueueView, elsewhere: string | null): DecisionQueueView =>
    elsewhere === null
        ? queue
        : {
              ...queue,
              rows: queue.rows.map((row) =>
                  row.primary === null && (row.alternative ?? null) === null && row.waitingFor === null
                      ? { ...row, waitingFor: elsewhere }
                      : row,
              ),
          }

/** The command of the queue's slot. */
type QueueCommand = RenderOf<typeof decisionQueueBlock>["slots"]["command"]

/** The function that sends one edited row through the command and answers how it went; a failed send answers with the shared failure. */
const editSenderOf =
    (command: QueueCommand) =>
    (rowId: string, values: FormValues): Promise<EditAnswer> =>
        command
            .run(editInputOf(rowId, values))
            .then(editAnswerOf)
            .catch(() => editFailure)

/** The decisions waiting for a person, each decided in place; as a card it keeps its place while nothing waits and says so inside. */
export const DecisionQueueBlock = (props: RenderOf<typeof decisionQueueBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.emptyTitle)
    const read = props.slots.queue
    const command = props.slots.command
    const spec = props.props
    const commands = useQueueCommands(command, spec.choices, () => host.notify("danger", labels.error))
    const options = parsedSlot(props.slots.options.slot, openOrdersView)
    const queueRows = parsedSlot(read.slot, decisionQueueView)
    const sendEdit = editSenderOf(command)
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
    const elsewhere = spec.elsewhere === undefined ? null : words(spec.elsewhere)
    const queue = derivedSlot(parsedSlot(read.slot, decisionQueueView), (view: DecisionQueueView) =>
        view.rows.length === 0
            ? null
            : answeredElsewhere(onePrimaryQueue(declaredQueue(view, spec.commands ?? [], spec.edit?.label, words)), elsewhere),
    )
    return (
        <>
            <SlotView
                slot={queue}
                labels={labels}
                placeholder={DECISION_QUEUE_PLACEHOLDER}
                forbidden="hide"
                empty="notice"
                emptyDescription={words(spec.emptyBody)}
                frame={(notice) => (
                    <QueueFrame surface={spec.surface} label={words(spec.label)}>
                        {notice}
                    </QueueFrame>
                )}
                onRetry={read.retry}
                render={(view, isLoading) => (
                    <DecisionList
                        surface={spec.surface}
                        commandSize={spec.commandSize ?? "sm"}
                        isHeadless={spec.isHeadless === true}
                        queue={view}
                        isLoading={isLoading}
                        edit={edit}
                        onCommand={commands.press}
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
            <QueueChoices
                pending={commands.pending}
                onClose={commands.close}
                onRun={commands.runWith}
                options={"items" in options ? options.items.rows : []}
                isLoading={"isLoading" in options}
                paymentVnd={amountOf(queueRows, commands.pending?.rowId ?? null)}
                pickWords={pickWordsOf(commands.pending?.choice ?? null, words)}
                confirmWords={confirmWordsOf(commands.pending?.choice ?? null, words)}
            />
        </>
    )
}
