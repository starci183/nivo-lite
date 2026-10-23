import type { ReactNode } from "react"
import { Alert, Button, Form } from "@starci/grammar/common"
import { AUTH_FIELDS_CLASS_NAME } from "./classNames"

/** The words and state of one auth form step. */
interface AuthFormProps {
    readonly label: string
    readonly isPending: boolean
    readonly failure?: { readonly title: string; readonly text: string } | undefined
    /** The primary submit button; omit when the children draw their own. */
    readonly submitLabel?: string
    /** Content below the submit button (links to other steps). */
    readonly footer?: ReactNode
    readonly onSubmit: () => void
    readonly children: ReactNode
}

/** One auth form step: a labelled form, the failure alert (when there is one) above the fields. */
export const AuthForm = (props: AuthFormProps) => (
    <Form label={props.label} onSubmit={props.onSubmit} isPending={props.isPending}>
        <div className={AUTH_FIELDS_CLASS_NAME}>
            {props.failure === undefined ? null : (
                <Alert title={props.failure.title} description={props.failure.text} tone="negative" />
            )}
            {props.children}
            {props.submitLabel === undefined ? null : (
                <Button variant="primary" width="fill" type="submit" isPending={props.isPending}>
                    {props.submitLabel}
                </Button>
            )}
            {props.footer}
        </div>
    </Form>
)
