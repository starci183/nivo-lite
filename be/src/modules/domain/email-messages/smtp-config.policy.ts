import type { ConnectionRecord } from "@modules/domain/connections"
import type { SmtpConfig } from "@modules/integrations/mail"

const DEFAULT_PORT = 587

/** The SMTP settings a connection holds in its public facts plus the password from its secret. */
export const smtpConfigOf = (meta: Readonly<Record<string, string>>, password: string): SmtpConfig => ({
    host: meta.host ?? "",
    port: Number(meta.port ?? DEFAULT_PORT),
    security: meta.security === "tls" ? "tls" : "starttls",
    user: meta.user ?? "",
    pass: password,
    fromName: meta.from_name ?? "",
    fromEmail: meta.from_email ?? "",
    replyTo: meta.reply_to === undefined || meta.reply_to === "" ? undefined : meta.reply_to,
})

/** The connected SMTP connection to send with: the one asked for, else the workspace default, else the oldest connected one. */
export const chooseSmtp = (
    records: ReadonlyArray<ConnectionRecord>,
    connectionId: string | undefined,
): ConnectionRecord | null => {
    const connected = records.filter(
        (record) => record.status === "connected" && (connectionId === undefined || record.id === connectionId),
    )
    return connected.find((record) => record.isDefault) ?? connected[0] ?? null
}
