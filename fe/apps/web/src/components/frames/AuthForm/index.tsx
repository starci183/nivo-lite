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

/**
 * One auth form step: a labelled form, the submit error (when there is one) above the fields. The browser's own bubble would stop an empty
 * submit before the form hook runs, so validation is `aria`: the submit goes through and each field shows its own message. The native fallback is a POST: a submit
 * before hydration would otherwise be a GET that puts the email and password in the URL, the server log and the browser history.
 */
export const AuthForm = (props: AuthFormProps) => (
    <Form
        label={props.label}
        method="post"
        validationBehavior="aria"
        onSubmit={props.onSubmit}
        isPending={props.isPending}
    >
        <Stack gap="row">
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
