import { Grid, Select } from "@starci/grammar/common"
import { ConnectionAccountInputs } from "@/components/leaves/ConnectionAccountInputs"

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

/** The mailbox sign-in fields of the IMAP wizard. */
export const ImapAccountFields = (props: ImapAccountFieldsProps) => {
    const { props: view, on } = props
    return (
        <Grid kind="form" columns={2}>
            <ConnectionAccountInputs
                owner="imap"
                fields={[
                    {
                        name: "name",
                        label: view.text.name,
                        value: view.values.name,
                        description: view.text.nameHint,
                        change: on.field("name"),
                    },
                    { name: "email", label: view.text.email, value: view.values.email, change: on.field("email") },
                ]}
                isDisabled={view.isDisabled}
                {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
            />
            <Select
                {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
                label={view.text.provider}
                isDisabled={view.isDisabled}
                value={view.preset}
                options={view.presets}
                onValueChange={(value) => value && on.preset(value)}
            />
            {view.isCustom ? renderImapAccountFieldsServerFields(view, on) : null}
            <ConnectionAccountInputs
                owner="imap"
                fields={[
                    {
                        name: "user",
                        label: view.text.user,
                        value: view.values.user,
                        description: view.text.userHint,
                        change: on.field("user"),
                    },
                    {
                        name: "password",
                        label: view.text.password,
                        value: view.values.password,
                        description: view.passwordHint,
                        change: on.field("password"),
                    },
                ]}
                isDisabled={view.isDisabled}
                {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
            />
        </Grid>
    )
}

/** Renders the ImapAccountFields server fields section. */
const renderImapAccountFieldsServerFields = (
    view: NonNullable<ImapAccountFieldsProps["props"]>,
    on: NonNullable<ImapAccountFieldsProps["on"]>,
) => (
    <>
        <ConnectionAccountInputs
            owner="imap"
            fields={[
                { name: "host", label: view.text.host, value: view.values.host, change: on.field("host") },
                { name: "port", label: view.text.port, value: view.values.port, change: on.field("port") },
            ]}
            isDisabled={view.isDisabled}
            {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
        />
        <Select
            {...(view.isLoading === undefined ? {} : { isLoading: view.isLoading })}
            label={view.text.security}
            isDisabled={view.isDisabled}
            value={view.values.security}
            options={view.securities}
            onValueChange={(value) => value && on.security(value)}
        />
    </>
)
