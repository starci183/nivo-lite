import { Alert, Button, Cluster } from "@starci/grammar/common"

/** What the foot of a form draws. */
type FormActionsProps = {
    /** Title of the negative alert. */
    readonly failTitle: string
    readonly error?: string | undefined
    readonly done?: string | undefined
    readonly submitLabel: string
    readonly isPending: boolean
    /** True while the form's data loads: the button keeps its place as a skeleton. */
    readonly isLoading: boolean
}

/** The foot of a form: the one failure or success alert over the submit button. */
export const FormActions = (props: FormActionsProps) => (
    <>
        {props.error === undefined ? null : <Alert tone="negative" title={props.failTitle} description={props.error} />}
        {props.done === undefined ? null : <Alert tone="affirmative" title={props.done} />}
        <Cluster gap="row">
            <Button type="submit" intent="commit" isPending={props.isPending} isLoading={props.isLoading}>
                {props.submitLabel}
            </Button>
        </Cluster>
    </>
)
