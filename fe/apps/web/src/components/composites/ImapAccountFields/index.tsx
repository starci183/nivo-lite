import { Input, Select } from "@starci/grammar/common"
import { imapAccountFieldsClassNames as classNames } from "./classNames"

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
        <div className={classNames.fields}>
            <Input
                id="imap-name"
                name="name"
                label={view.text.name}
                hint={view.text.nameHint}
                isDisabled={view.isDisabled}
                value={view.values.name}
                onValueChange={on.field("name")}
            />
            <Input
                id="imap-email"
                name="email"
                label={view.text.email}
                isDisabled={view.isDisabled}
                value={view.values.email}
                onValueChange={on.field("email")}
            />
            <Select
                label={view.text.provider}
                isDisabled={view.isDisabled}
                value={view.preset}
                options={view.presets}
                onValueChange={(value) => value && on.preset(value)}
            />
            {view.isCustom ? renderImapAccountFieldsServerFields(view, on) : null}
            <Input
                id="imap-user"
                name="user"
                label={view.text.user}
                hint={view.text.userHint}
                isDisabled={view.isDisabled}
                value={view.values.user}
                onValueChange={on.field("user")}
            />
            <Input
                id="imap-password"
                name="password"
                kind="password"
                label={view.text.password}
                hint={view.passwordHint}
                isDisabled={view.isDisabled}
                value={view.values.password}
                onValueChange={on.field("password")}
            />
        </div>
    )
}

/** Renders the ImapAccountFields server fields section. */
const renderImapAccountFieldsServerFields = (
    view: NonNullable<ImapAccountFieldsProps["props"]>,
    on: NonNullable<ImapAccountFieldsProps["on"]>,
) => (
    <>
        <Input
            id="imap-host"
            name="host"
            label={view.text.host}
            isDisabled={view.isDisabled}
            value={view.values.host}
            onValueChange={on.field("host")}
        />
        <Input
            id="imap-port"
            name="port"
            label={view.text.port}
            isDisabled={view.isDisabled}
            value={view.values.port}
            onValueChange={on.field("port")}
        />
        <Select
            label={view.text.security}
            isDisabled={view.isDisabled}
            value={view.values.security}
            options={view.securities}
            onValueChange={(value) => value && on.security(value)}
        />
    </>
)
