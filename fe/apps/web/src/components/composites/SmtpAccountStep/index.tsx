import { Input, Select, Text, Stack } from "@starci/grammar/common"
import type { SmtpAccountView, SmtpText } from "@/modules/types"

/** The `isLoading` prop, spread only when the caller states it (an absent flag stays absent). */
const loadingOf = (isLoading: boolean | undefined) => (isLoading === undefined ? {} : { isLoading })

/** What the sender step draws and reports. */
type SmtpAccountStepProps = {
    readonly isLoading?: boolean

    readonly account: SmtpAccountView
    readonly text: SmtpText
    /** The connection is saved: the fields stay as they were and the password is never shown. */
    readonly isLocked: boolean
    readonly isPending: boolean
    readonly onField: (name: "fromName" | "fromEmail" | "replyTo" | "user" | "password", value: string) => void
    readonly onHost: (value: string) => void
    readonly onPort: (value: string) => void
    readonly onSecurity: (value: "starttls" | "tls") => void
}

/** The sender details and password of the outgoing mailbox; the host, port and security only when the owner types them. */
export const SmtpAccountStep = (props: SmtpAccountStepProps) => {
    const { account, text } = props
    const locked = props.isLocked || props.isPending
    return (
        <>
            <Stack gap="section">
                <SmtpSenderField
                    props={props}
                    field="fromName"
                    label={text.fieldFromName}
                    description={text.fieldFromNameHint}
                />
                <SmtpSenderField
                    props={props}
                    field="fromEmail"
                    label={text.fieldFromEmail}
                    description={text.fieldFromEmailHint}
                />
                <SmtpSenderField
                    props={props}
                    field="replyTo"
                    label={text.fieldReplyTo}
                    description={text.fieldReplyToHint}
                />
                {account.showHost ? renderSmtpAccountStepServerFields(text, locked, account, props) : null}
                {account.showUser ? (
                    <Input
                        {...loadingOf(props.isLoading)}
                        id="smtp-user"
                        name="user"
                        label={text.fieldUser}
                        description={text.fieldUserHint}
                        isDisabled={locked}
                        value={account.values.user}
                        onValueChange={(v) => props.onField("user", v)}
                    />
                ) : null}
                {account.showPassword ? renderSmtpAccountStepPassword(account, locked, props) : null}
            </Stack>
            {account.fixedUserNote === null ? null : (
                <Text {...loadingOf(props.isLoading)} size="xs" tone="muted">
                    {account.fixedUserNote}
                </Text>
            )}
            {account.prefilledNote === null ? null : (
                <Text {...loadingOf(props.isLoading)} size="xs" tone="muted">
                    {account.prefilledNote}
                </Text>
            )}
            <Text size="xs" tone="muted">
                {text.passwordStored}
            </Text>
        </>
    )
}

/** Renders the SmtpAccountStep server fields section. */
const renderSmtpAccountStepServerFields = (
    text: NonNullable<SmtpAccountStepProps["text"]>,
    locked: boolean,
    account: NonNullable<SmtpAccountStepProps["account"]>,
    props: SmtpAccountStepProps,
) => (
    <>
        <Input
            {...loadingOf(props.isLoading)}
            id="smtp-host"
            name="host"
            label={text.fieldHost}
            isDisabled={locked}
            value={account.host}
            onValueChange={props.onHost}
        />
        <Input
            {...loadingOf(props.isLoading)}
            id="smtp-port"
            name="port"
            label={text.fieldPort}
            isDisabled={locked}
            value={account.port}
            onValueChange={props.onPort}
        />
        <Select
            {...loadingOf(props.isLoading)}
            label={text.fieldSecurity}
            isDisabled={locked}
            value={account.security}
            options={[...account.securityOptions]}
            onValueChange={(v) => props.onSecurity(v === "tls" ? "tls" : "starttls")}
        />
    </>
)

/** Renders the SmtpAccountStep password section. */
const renderSmtpAccountStepPassword = (
    account: NonNullable<SmtpAccountStepProps["account"]>,
    locked: boolean,
    props: SmtpAccountStepProps,
) => (
    <Input
        {...loadingOf(props.isLoading)}
        id="smtp-password"
        name="password"
        label={account.passwordLabel}
        kind="password"
        description={account.passwordHint}
        isDisabled={locked}
        value={props.isLocked ? "" : account.values.password}
        onValueChange={(v) => props.onField("password", v)}
    />
)

interface SmtpSenderFieldProps {
    readonly props: SmtpAccountStepProps
    readonly field: "fromName" | "fromEmail" | "replyTo"
    readonly label: string
    readonly description: string
}
/** Sender identity fields share the same lock, first-read and addressed edit behavior. */
const SmtpSenderField = (input: SmtpSenderFieldProps) => {
    const props = input.props
    return (
        <Input
            {...loadingOf(props.isLoading)}
            id={SMTP_SENDER_IDS[input.field]}
            name={input.field}
            label={input.label}
            description={input.description}
            isDisabled={props.isLocked || props.isPending}
            value={props.account.values[input.field]}
            onValueChange={(value) => props.onField(input.field, value)}
        />
    )
}

const SMTP_SENDER_IDS = { fromName: "smtp-from-name", fromEmail: "smtp-from-email", replyTo: "smtp-reply-to" } as const
