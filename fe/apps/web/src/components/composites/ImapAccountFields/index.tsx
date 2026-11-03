import { Grid } from "@starci/grammar/common"
import { FormFieldList, type FormFieldItem } from "@/components/leaves/FormFieldList"
import { textFieldsOf } from "@/modules/types"

/** A text field of the mailbox sign-in form. */
type ImapTextField = "name" | "email" | "host" | "port" | "user" | "password"

/** One option of a select. */
interface ImapSelectOption {
    readonly id: string
    readonly label: string
}

/** What the sign-in fields draw: the mailbox, the provider (with host, port and security for "other") and the sign-in. */
export interface ImapAccountFieldsProps {
    readonly props: {
        readonly isLoading?: boolean

        readonly values: Readonly<Record<ImapTextField | "security", string>>
        readonly preset: string
        readonly presets: ReadonlyArray<ImapSelectOption>
        readonly securities: ReadonlyArray<ImapSelectOption>
        /** True when the provider is "other": the server fields are shown. */
        readonly isCustom: boolean
        readonly passwordHint: string
        readonly isDisabled: boolean
        readonly text: Readonly<
            Record<
                | "name"
                | "nameHint"
                | "email"
                | "provider"
                | "host"
                | "port"
                | "security"
                | "user"
                | "userHint"
                | "password",
                string
            >
        >
    }
    readonly on: {
        readonly field: (field: ImapTextField) => (value: string) => void
        readonly preset: (value: string) => void
        readonly security: (value: string) => void
    }
}

/** The server fields shown for a custom provider: host, port and the security choice. */
const serverFieldsOf = (
    view: ImapAccountFieldsProps["props"],
    on: ImapAccountFieldsProps["on"],
): ReadonlyArray<FormFieldItem> => [
    ...textFieldsOf(["host", "port"], { text: view.text, values: view.values, field: on.field }),
    {
        kind: "choice",
        name: "security",
        label: view.text.security,
        value: view.values.security,
        options: view.securities,
        change: (value) => {
            if (value) on.security(value)
        },
    },
]

/** The mailbox, provider, server and sign-in fields in the order they are drawn. */
const fieldsOf = (
    view: ImapAccountFieldsProps["props"],
    on: ImapAccountFieldsProps["on"],
): ReadonlyArray<FormFieldItem> => {
    const source = { text: view.text, values: view.values, field: on.field }
    return [
        ...textFieldsOf(["name", "email"], source, { name: { description: view.text.nameHint } }),
        {
            kind: "choice",
            name: "provider",
            label: view.text.provider,
            value: view.preset,
            options: view.presets,
            change: (value) => {
                if (value) on.preset(value)
            },
        },
        ...(view.isCustom ? serverFieldsOf(view, on) : []),
        ...textFieldsOf(["user", "password"], source, {
            user: { description: view.text.userHint },
            password: { description: view.passwordHint, isSecret: true },
        }),
    ]
}

/** The mailbox sign-in fields of the IMAP wizard. */
export const ImapAccountFields = (props: ImapAccountFieldsProps) => (
    <Grid kind="form" columns={2}>
        <FormFieldList
            idPrefix="imap"
            fields={fieldsOf(props.props, props.on)}
            isDisabled={props.props.isDisabled}
            {...(props.props.isLoading === undefined ? {} : { isLoading: props.props.isLoading })}
        />
    </Grid>
)
