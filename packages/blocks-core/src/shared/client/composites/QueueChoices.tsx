import type { ReactNode } from "react"
import { AlertDialog } from "@starci/grammar/common"
import type { OpenOrderRow } from "../../rules/open-orders"
import { pickedValues, type Choice } from "../../rows/decision-choices"
import { OrderPicker, type OrderPickerWords } from "./OrderPicker"

/** What the overlays of the choices take. */
export interface QueueChoicesProps {
    /** The row command that is open, with the row it is about; null when none is. */
    readonly pending: { readonly rowId: string; readonly choice: Choice } | null
    /** Closes the open overlay without running anything. */
    readonly onClose: () => void
    /** Runs the action for a row with the command it receives and its values. */
    readonly onRun: (rowId: string, commandId: string, values: Readonly<Record<string, string>>) => Promise<void>
    /** The options a pick lists. */
    readonly options: ReadonlyArray<OpenOrderRow>
    /** Whether the options are still being read. */
    readonly isLoading: boolean
    /** The amount of the payment the open row is about, in VND. */
    readonly paymentVnd: number
    /** The words of a pick for the open choice; null when it is not a pick. */
    readonly pickWords: OrderPickerWords | null
    /** The words of a confirmation for the open choice; null when it is not one. */
    readonly confirmWords: {
        readonly title: string
        readonly body: string
        readonly confirm: string
        readonly cancel: string
    } | null
}

/** The overlay of the open choice: the picker of an option, or the confirmation, which runs the action when the person decides. */
export const QueueChoices = (props: QueueChoicesProps): ReactNode => {
    const { pending } = props
    if (pending === null) return null
    const { choice, rowId } = pending
    if (choice.pick !== undefined && props.pickWords !== null)
        return (
            <OrderPicker
                isOpen
                onClose={props.onClose}
                options={props.options}
                isLoading={props.isLoading}
                paymentVnd={props.paymentVnd}
                words={props.pickWords}
                onChoose={(id) => {
                    props.onClose()
                    void props.onRun(rowId, choice.sends, pickedValues(choice, id) ?? {})
                }}
            />
        )
    if (choice.confirm === undefined || props.confirmWords === null) return null
    const values = choice.confirm.values
    return (
        <AlertDialog
            isOpen
            onOpenChange={(open) => {
                if (!open) props.onClose()
            }}
            tone="informative"
            title={props.confirmWords.title}
            description={props.confirmWords.body}
            confirmLabel={props.confirmWords.confirm}
            cancelLabel={props.confirmWords.cancel}
            onConfirm={() => props.onRun(rowId, choice.sends, values).then(props.onClose)}
        />
    )
}
