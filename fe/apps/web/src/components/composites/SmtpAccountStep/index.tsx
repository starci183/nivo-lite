import { Input, Select, Text } from "@starci/grammar/common"
import type { SmtpAccountView, SmtpText } from "@/modules/types"
import { smtpAccountStepClassNames as classNames } from "./classNames"

/** What the sender step draws and reports. */
type SmtpAccountStepProps = {
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
            <div className={classNames.fields}>
                <Input
                    id="smtp-from-name"
                    name="fromName"
                    label={text.fieldFromName}
                    variant="secondary"
                    hint={text.fieldFromNameHint}
                    isDisabled={locked}
                    value={account.values.fromName}
                    onValueChange={(v) => props.onField("fromName", v)}
                />
                <Input
                    id="smtp-from-email"
                    name="fromEmail"
                    label={text.fieldFromEmail}
                    variant="secondary"
                    hint={text.fieldFromEmailHint}
                    isDisabled={locked}
                    value={account.values.fromEmail}
                    onValueChange={(v) => props.onField("fromEmail", v)}
                />
                <Input
                    id="smtp-reply-to"
                    name="replyTo"
                    label={text.fieldReplyTo}
                    variant="secondary"
                    hint={text.fieldReplyToHint}
                    isDisabled={locked}
                    value={account.values.replyTo}
                    onValueChange={(v) => props.onField("replyTo", v)}
                />
                {account.showHost ? (
                    <>
                        <Input
                            id="smtp-host"
                            name="host"
                            label={text.fieldHost}
                            variant="secondary"
                            isDisabled={locked}
                            value={account.host}
                            onValueChange={props.onHost}
                        />
                        <Input
                            id="smtp-port"
                            name="port"
                            label={text.fieldPort}
                            variant="secondary"
                            isDisabled={locked}
                            value={account.port}
                            onValueChange={props.onPort}
                        />
                        <Select
                            label={text.fieldSecurity}
                            variant="secondary"
                            isDisabled={locked}
                            value={account.security}
                            options={[...account.securityOptions]}
                            onValueChange={(v) => props.onSecurity(v === "tls" ? "tls" : "starttls")}
                        />
                    </>
                ) : null}
                {account.showUser ? (
                    <Input
                        id="smtp-user"
                        name="user"
                        label={text.fieldUser}
                        variant="secondary"
                        hint={text.fieldUserHint}
                        isDisabled={locked}
                        value={account.values.user}
                        onValueChange={(v) => props.onField("user", v)}
                    />
                ) : null}
                {account.showPassword ? (
                    <Input
                        id="smtp-password"
                        name="password"
                        label={account.passwordLabel}
                        variant="secondary"
                        kind="password"
                        hint={account.passwordHint}
                        isDisabled={locked}
                        value={props.isLocked ? "" : account.values.password}
                        onValueChange={(v) => props.onField("password", v)}
                    />
                ) : null}
            </div>
            {account.fixedUserNote === null ? null : (
                <Text size="xs" tone="muted">
                    {account.fixedUserNote}
                </Text>
            )}
            {account.prefilledNote === null ? null : (
                <Text size="xs" tone="muted">
                    {account.prefilledNote}
                </Text>
            )}
            <Text size="xs" tone="muted">
                {text.passwordStored}
            </Text>
        </>
    )
}
