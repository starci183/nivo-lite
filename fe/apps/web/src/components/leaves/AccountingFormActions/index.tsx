import { Button } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** The way out and the primary action of a form. */
interface AccountingFormActionsProps {
    readonly cancelLabel: string
    readonly saveLabel: string
    readonly isSaving: boolean
    readonly onCancel: () => void
}

/** The closing line of a form: the way out first, the primary action last. */
export const AccountingFormActions = (props: AccountingFormActionsProps) => (
    <div className={ACTIONS_CLASS_NAME}>
        <Button intent="neutral" isDisabled={props.isSaving} onPress={props.onCancel}>
            {props.cancelLabel}
        </Button>
        <Button intent="commit" type="submit" isPending={props.isSaving}>
            {props.saveLabel}
        </Button>
    </div>
)
