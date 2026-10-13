import { isMailAddress } from "./email-address.policy"
import { EmailMessagesErrorCode } from "./errors/email-messages.error"
import type { SmtpForm, SmtpFormInput } from "./smtp-wizard.contracts"

const PRESETS: ReadonlyArray<string> = [
    "google_workspace",
    "gmail",
    "microsoft365",
    "zoho",
    "vn_hosting",
    "relay_service",
]
const GOOGLE_PRESETS: ReadonlyArray<string> = ["gmail", "google_workspace"]
const GOOGLE_RELAY_HOST = "smtp-relay.gmail.com"
const PORT_MAX = 65535

/** The outcome of cleaning the form: the form, or the first problem found. */
export type SmtpFormVerdict =
    { readonly ok: true; readonly form: SmtpForm } | { readonly ok: false; readonly code: EmailMessagesErrorCode }

const clean = (text: string, max: number): string => text.trim().slice(0, max)

/** Whether the id is one of the providers the wizard offers. */
export const isSmtpPreset = (preset: string): boolean => PRESETS.includes(preset)

/** The password as the provider wants it: Google app passwords lose every whitespace, the others are trimmed. */
export const cleanSmtpPassword = (preset: string, password: string): string =>
    GOOGLE_PRESETS.includes(preset) ? password.replace(/\s+/gu, "") : password.trim()

/** Validates and cleans the wizard form; the first problem found decides the answer. */
export const cleanSmtpForm = (input: SmtpFormInput): SmtpFormVerdict => {
    if (!isSmtpPreset(input.preset)) return { ok: false, code: EmailMessagesErrorCode.SmtpInvalid }
    const host = clean(input.host, 253).toLowerCase()
    const fromName = clean(input.fromName, 80).replace(/[\r\n"<>]/gu, "")
    const fromEmail = clean(input.fromEmail, 254).toLowerCase()
    const replyTo = clean(input.replyTo, 254).toLowerCase()
    const user = clean(input.user, 254)
    if (host === "") return { ok: false, code: EmailMessagesErrorCode.SmtpHost }
    if (!Number.isInteger(input.port) || input.port < 1 || input.port > PORT_MAX) {
        return { ok: false, code: EmailMessagesErrorCode.SmtpPort }
    }
    if (fromName === "" || user === "" || fromEmail === "")
        return { ok: false, code: EmailMessagesErrorCode.SmtpFields }
    if (!isMailAddress(fromEmail) || (replyTo !== "" && !isMailAddress(replyTo))) {
        return { ok: false, code: EmailMessagesErrorCode.SmtpEmail }
    }
    const relay = input.preset === "google_workspace" && host === GOOGLE_RELAY_HOST
    if (input.password.trim() === "" && !relay) return { ok: false, code: EmailMessagesErrorCode.SmtpFields }
    return {
        ok: true,
        form: {
            preset: input.preset,
            host,
            port: input.port,
            security: input.security === "tls" ? "tls" : "starttls",
            user,
            password: cleanSmtpPassword(input.preset, input.password),
            fromName,
            fromEmail,
            replyTo,
        },
    }
}

/** The password inside an opened SMTP credential (a JSON value with a `password`), or null when there is none. */
export const passwordOfParsed = (parsed: unknown): string | null => {
    const password: unknown = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "password") : null
    return typeof password === "string" ? password : null
}
