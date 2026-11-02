import type { ReactNode } from "react"
import { Alert, Button, Form, Stack } from "@starci/grammar/common"

/** The words and state of one auth form step. */
interface AuthFormProps {
    readonly label: string
    readonly isPending: boolean
    /** The resolved reason the last submit was turned down; drawn above the fields. */
    readonly error?: { readonly title: string; readonly text: string } | undefined
    /** The primary submit button; omit when the children draw their own. */
    readonly submitLabel?: string
    /** Content below the submit button (links to other steps). */
    readonly footer?: ReactNode
    readonly onSubmit: () => void
    readonly children: ReactNode
}

/** One auth form step: a labelled form, the submit error (when there is one) above the fields. */
export const AuthForm = (props: AuthFormProps) => (
    <Form label={props.label} onSubmit={props.onSubmit} isPending={props.isPending}>
        <Stack gap="section">
            {props.error === undefined ? null : (
                <Alert title={props.error.title} description={props.error.text} tone="negative" />
            )}
            {props.children}
            {props.submitLabel === undefined ? null : (
                <Button intent="commit" width="fill" type="submit" isPending={props.isPending}>
                    {props.submitLabel}
                </Button>
            )}
            {props.footer}
        </Stack>
    </Form>
)
