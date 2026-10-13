import type { Settled } from "@/hooks/connection-wizard"
import { modeOf, SMTP_PRESETS } from "@/modules/mail"
import type { Security, SmtpPreset } from "@/modules/mail"

/** The steps of the outgoing-email wizard, in order. */
export const SMTP_STEPS = ["provider", "guide", "account", "verify"] as const

/** What the wizard sends to store an outgoing-email connection. */
export interface SmtpInput {
    readonly preset: string
    readonly host: string
    readonly port: number
    readonly security: Security
    readonly user: string
    readonly password: string
    readonly fromName: string
    readonly fromEmail: string
    readonly replyTo: string
}

/** The stored connection the wizard keeps for its test step (never carries the password). */
export interface SmtpView {
    readonly id: string
    readonly host: string
    readonly fromEmail: string
    readonly isDefault: boolean
}

/** What a test email answered. */
export interface SmtpTested {
    readonly to: string
    readonly isDefault: boolean
}

/** The GraphQL commands of the outgoing-email wizard and its row (the active workspace travels in the request header). */
export interface SmtpCommands {
    readonly start: (input: SmtpInput) => Promise<Settled<SmtpView>>
    readonly sendTest: (connectionId: string, to: string, makeDefault: boolean) => Promise<Settled<SmtpTested>>
    readonly changePassword: (connectionId: string, password: string) => Promise<Settled<true>>
    readonly setDefault: (connectionId: string) => Promise<Settled<true>>
}

/** Where the mailbox lives: the chosen provider and way of sending, with the connection facts they prefill and the owner may edit. */
export interface SmtpChoice {
    readonly presetId: string
    readonly modeId: string
    readonly host: string
    readonly port: string
    readonly security: Security
}

/** The sender details the owner types. */
export interface SmtpFields {
    readonly fromName: string
    readonly fromEmail: string
    readonly replyTo: string
    readonly user: string
    readonly password: string
}

/** The test email step: where to send it, whether the connection becomes the default, and the address it was really sent to. */
export interface SmtpTest {
    readonly to: string
    readonly makeDefault: boolean
    readonly sentTo: string | null
}

/** The mail provider of this id, or the first one. */
export const presetOrFirst = (id: string): SmtpPreset =>
    SMTP_PRESETS.find((preset) => preset.id === id) ?? SMTP_PRESETS[0]

/** The prefilled choice for a provider and way of sending. */
export const choiceOf = (preset: SmtpPreset, modeId: string): SmtpChoice => {
    const mode = modeOf(preset, modeId)
    return { presetId: preset.id, modeId: mode.id, host: mode.host, port: String(mode.port), security: mode.security }
}

/** The username the connection logs in with: the provider's fixed one, the typed one, or the sender mailbox. */
export const usernameOf = (preset: SmtpPreset, choice: SmtpChoice, fields: SmtpFields): string => {
    const mode = modeOf(preset, choice.modeId)
    return mode.fixedUser ?? (fields.user.trim() || (mode.userIsEmail ? fields.fromEmail.trim() : ""))
}

/** Whether the sender form asks for a password (Google's relay needs none). */
export const needsPasswordOf = (preset: SmtpPreset, choice: SmtpChoice): boolean =>
    !(preset.id === "google_workspace" && choice.modeId === "relay")

/** Whether the sender form is complete enough to save. */
export const isReadyToSave = (preset: SmtpPreset, choice: SmtpChoice, fields: SmtpFields): boolean =>
    fields.fromName.trim() !== "" &&
    fields.fromEmail.trim() !== "" &&
    usernameOf(preset, choice, fields) !== "" &&
    choice.host.trim() !== "" &&
    (!needsPasswordOf(preset, choice) || fields.password.trim() !== "")
