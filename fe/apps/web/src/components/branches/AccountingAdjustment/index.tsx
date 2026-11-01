import { Alert, Button, Form, Input, Text, Textarea } from "@starci/grammar/common"
import { AccountingFormActions } from "@/components/leaves/AccountingFormActions"
import { BLOCK_CLASS_NAME, FORM_ACTIONS_CLASS_NAME } from "./classNames"

interface LedgerAdjustForm {
    readonly intro: string
    readonly noteLabel: string
    readonly noteHint: string
    readonly amountLabel: string
    readonly amountHint: string
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly note: string
    readonly amount: string
    readonly isSaving: boolean
    readonly error: string | null
}

/** Settled copy and values of the append-only correction controls. */
export interface AccountingAdjustmentView {
    readonly adjustTitle: string
    readonly adjustMode: "notReady" | "managersOnly" | "form" | "button" | "unavailable"
    readonly notReadyText: string
    readonly managersOnlyText: string
    /** Said for a line a correction cannot be attached to (a supplier payment). */
    readonly unavailableText: string
    readonly openLabel: string
    readonly form: LedgerAdjustForm
}
/** The correction controls and their reader actions. */
interface AccountingAdjustmentProps {
    readonly props: AccountingAdjustmentView
    readonly on: {
        readonly startAdjust: () => void
        readonly cancelAdjust: () => void
        readonly changeNote: (value: string) => void
        readonly changeAmount: (value: string) => void
        readonly submitAdjust: () => void
    }
}

const AdjustForm = (props: AccountingAdjustmentProps) => {
    const form = props.props.form
    return (
        <Form label={props.props.adjustTitle} isPending={form.isSaving} onSubmit={props.on.submitAdjust}>
            <div className={BLOCK_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {form.intro}
                </Text>
                <Textarea
                    id="wb-adj-note"
                    name="note"
                    label={form.noteLabel}
                    rows={3}
                    value={form.note}
                    isRequired
                    isDisabled={form.isSaving}
                    description={form.noteHint}
                    onValueChange={props.on.changeNote}
                />
                <Input
                    id="wb-adj-amount"
                    name="amount"
                    label={form.amountLabel}
                    value={form.amount}
                    isDisabled={form.isSaving}
                    description={form.amountHint}
                    onValueChange={props.on.changeAmount}
                />
                {form.error === null ? null : <Alert tone="negative" title={form.error} />}
                <AccountingFormActions
                    cancelLabel={form.cancelLabel}
                    saveLabel={form.saveLabel}
                    isSaving={form.isSaving}
                    onCancel={props.on.cancelAdjust}
                />
            </div>
        </Form>
    )
}

/** Displays correction permissions, the open action or the append-only form. */
export const AccountingAdjustment = (props: AccountingAdjustmentProps) => {
    const drawer = props.props
    if (drawer.adjustMode === "notReady") {
        return (
            <Text size="sm" tone="muted">
                {drawer.notReadyText}
            </Text>
        )
    }
    if (drawer.adjustMode === "managersOnly") {
        return (
            <Text size="sm" tone="muted">
                {drawer.managersOnlyText}
            </Text>
        )
    }
    if (drawer.adjustMode === "unavailable") {
        return (
            <Text size="sm" tone="muted">
                {drawer.unavailableText}
            </Text>
        )
    }
    if (drawer.adjustMode === "form") return <AdjustForm props={drawer} on={props.on} />
    return (
        <div className={FORM_ACTIONS_CLASS_NAME}>
            <Button intent="neutral" onPress={props.on.startAdjust}>
                {drawer.openLabel}
            </Button>
        </div>
    )
}
