import { Alert, Button } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** What the foot of a form draws. */
type FormActionsProps = {
    /** Title of the negative alert. */
    readonly failTitle: string
    readonly error?: string | undefined
    readonly done?: string | undefined
    readonly submitLabel: string
    readonly isPending: boolean
    /** True while the form's data loads: the button keeps its place as a skeleton. */
    readonly isSkeleton: boolean
}

/** The foot of a form: the one failure or success alert over the submit button. */
export const FormActions = (props: FormActionsProps) => (
    <>
        {props.error === undefined ? null : <Alert tone="negative" title={props.failTitle} description={props.error} />}
        {props.done === undefined ? null : <Alert tone="affirmative" title={props.done} />}
        <div className={ACTIONS_CLASS_NAME}>
            <Button type="submit" intent="commit" isPending={props.isPending} isSkeleton={props.isSkeleton}>
                {props.submitLabel}
            </Button>
        </div>
    </>
)
