import { Button, Cluster } from "@starci/grammar/common"

/** The way out and the primary action of a form. */
interface AccountingFormActionsProps {
    readonly cancelLabel: string
    readonly saveLabel: string
    readonly isSaving: boolean
    readonly onCancel: () => void
}

/** The closing line of a form: the way out first, the primary action last. */
export const AccountingFormActions = (props: AccountingFormActionsProps) => (
    <Cluster gap="row">
        <Button intent="neutral" isDisabled={props.isSaving} onPress={props.onCancel}>
            {props.cancelLabel}
        </Button>
        <Button intent="commit" type="submit" isPending={props.isSaving}>
            {props.saveLabel}
        </Button>
    </Cluster>
)
