import { Button, Cluster, Stack, Textarea } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { WorkbenchWaitingList, type WorkbenchWaitingListProps } from "@/components/composites/WorkbenchWaitingList"
import type { DataSlot, SlotLabels, WorkbenchRowView } from "@/modules/types"

/** The reply a person is changing before it goes, and the words around it. */
interface ReplyEditView {
    readonly workItemId: string
    readonly text: string
    readonly label: string
    readonly sendLabel: string
    readonly cancelLabel: string
    readonly isBusy: boolean
}

/** Props for {@link ChatbotWaitingBase}. */
export interface ChatbotWaitingBaseProps {
    readonly props: {
        readonly slot: DataSlot<ReadonlyArray<WorkbenchRowView>>
        readonly slotLabels: SlotLabels
        /** One empty row, drawn as a skeleton while the rows are read. */
        readonly placeholder: ReadonlyArray<WorkbenchRowView>
        /** The words and counts of the card; the rows come from the slot. */
        readonly list: Omit<WorkbenchWaitingListProps, "surface" | "items" | "isSkeleton">
        /** The reply open for editing; null while none is. */
        readonly edit: ReplyEditView | null
    }
    readonly on: {
        readonly retry: () => void
        readonly changeEdit: (text: string) => void
        readonly sendEdit: () => void
        readonly cancelEdit: () => void
    }
}

/** The editor of one reply: the text, then send and cancel. */
interface ReplyEditorProps {
    readonly edit: ReplyEditView
    readonly on: ChatbotWaitingBaseProps["on"]
}

const ReplyEditor = (props: ReplyEditorProps) => (
    <Stack gap="inline">
        <Textarea
            label={props.edit.label}
            rows={4}
            value={props.edit.text}
            isDisabled={props.edit.isBusy}
            onValueChange={props.on.changeEdit}
        />
        <Cluster gap="inline">
            <Button
                intent="alternative"
                size="sm"
                isPending={props.edit.isBusy}
                isDisabled={props.edit.text.trim() === ""}
                onPress={props.on.sendEdit}
            >
                {props.edit.sendLabel}
            </Button>
            <Button intent="neutral" size="sm" isDisabled={props.edit.isBusy} onPress={props.on.cancelEdit}>
                {props.edit.cancelLabel}
            </Button>
        </Cluster>
    </Stack>
)

/** Draws the "waiting for you" card of the Chatbot workbench: the decisions that wait for a person, each decided or edited in place. */
export const ChatbotWaitingBase = (props: ChatbotWaitingBaseProps) => {
    const edit = props.props.edit
    return (
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.slotLabels}
            empty="collapse"
            onRetry={props.on.retry}
        >
            {(rows, isSkeleton) => (
                <WorkbenchWaitingList
                    {...props.props.list}
                    surface="card"
                    items={rows.map((row) => ({
                        row,
                        editor:
                            edit !== null && edit.workItemId === row.id ? (
                                <ReplyEditor edit={edit} on={props.on} />
                            ) : undefined,
                    }))}
                    isSkeleton={isSkeleton}
                />
            )}
        </SlotView>
    )
}
