import type { ImapAccountValues } from "@/hooks/rhf"
import type { ImapWizardState } from "./useImapWizard"

/** How the mailbox connection is secured. */
export type ImapSecurity = "tls" | "starttls"

/** Mail providers with a known IMAP address. `other` asks for host and port. */
export type ImapPresetId = "gmail" | "outlook" | "zoho" | "yahoo" | "other"

/** One provider preset: where its IMAP server is. */
export interface ImapPreset {
    /** The preset id. */
    readonly id: ImapPresetId
    /** The IMAP server. */
    readonly host: string
    /** The IMAP port. */
    readonly port: number
}

/** The steps of the mailbox wizard, in order. */
export const IMAP_STEPS = ["account", "folders", "schedule", "agent"] as const

/** One step of the mailbox wizard. */
export type ImapStep = (typeof IMAP_STEPS)[number]

/** How far back the first sync reads, in days. */
export const IMAP_SINCE_DAYS = [7, 30, 90] as const

/** The sync schedule choices: the label key and the minutes (null is manual only). */
export const IMAP_EVERY: ReadonlyArray<{
    readonly key: "everyManual" | "every15" | "every60" | "every360"
    readonly minutes: number | null
}> = [
    { key: "everyManual", minutes: null },
    { key: "every15", minutes: 15 },
    { key: "every60", minutes: 60 },
    { key: "every360", minutes: 360 },
]

/** The provider presets. */
export const IMAP_PRESETS: readonly [ImapPreset, ...ImapPreset[]] = [
    { id: "gmail", host: "imap.gmail.com", port: 993 },
    { id: "outlook", host: "outlook.office365.com", port: 993 },
    { id: "zoho", host: "imap.zoho.com", port: 993 },
    { id: "yahoo", host: "imap.mail.yahoo.com", port: 993 },
    { id: "other", host: "", port: 993 },
]

/** The usual port of a security kind. */
export const defaultPort = (security: ImapSecurity): number => (security === "tls" ? 993 : 143)

/** The preset a saved host belongs to. */
export const presetOfHost = (host: string): ImapPresetId =>
    IMAP_PRESETS.find((preset) => preset.host !== "" && preset.host === host)?.id ?? "other"

/** A saved or typed security word as a security kind. */
export const securityOf = (value: string): ImapSecurity => (value === "starttls" ? "starttls" : "tls")

/** A saved mailbox as the wizard edits it (never the password). */
export interface ImapMailbox {
    /** The connection id. */
    readonly id: string
    /** The connection name. */
    readonly name: string
    /** The mailbox address. */
    readonly email: string
    /** The IMAP server. */
    readonly host: string
    /** The IMAP port. */
    readonly port: number
    /** The kind of security. */
    readonly security: ImapSecurity
    /** The login name. */
    readonly user: string
    /** The folders read. */
    readonly folders: ReadonlyArray<string>
    /** How many days back a first read goes. */
    readonly sinceDays: number
    /** Minutes between scheduled syncs; null is manual only. */
    readonly syncEveryMinutes: number | null
    /** Agents that hold a grant on this mailbox. */
    readonly agentIds: ReadonlyArray<string>
}

/** The `connectorImap` key of each provider's app-password guide. */
export const IMAP_GUIDE_KEY = {
    gmail: "guideGmail",
    outlook: "guideOutlook",
    zoho: "guideZoho",
    yahoo: "guideYahoo",
    other: "guideOther",
} as const satisfies Record<ImapPresetId, string>

/** The `connectorImap` key of each provider's name. */
export const IMAP_PRESET_KEY = {
    gmail: "presetGmail",
    outlook: "presetOutlook",
    zoho: "presetZoho",
    yahoo: "presetYahoo",
    other: "presetOther",
} as const satisfies Record<ImapPresetId, string>

/** The `connectorImap` key of each first-sync period. */
export const IMAP_SINCE_KEY = { 7: "since7", 30: "since30", 90: "since90" } as const satisfies Record<
    (typeof IMAP_SINCE_DAYS)[number],
    string
>

/** Restores a saved connection or prepares the initial wizard state. */
export const stateOf = (mailbox: ImapMailbox | undefined): ImapWizardState => ({
    index: 0,
    savedId: mailbox === undefined ? null : mailbox.id,
    preset: mailbox === undefined ? "gmail" : presetOfHost(mailbox.host),
    folderList: mailbox === undefined ? [] : mailbox.folders,
    tested: null,
    folders: mailbox === undefined ? ["INBOX"] : mailbox.folders,
    sinceDays: mailbox === undefined ? 30 : mailbox.sinceDays,
    every: mailbox === undefined ? 60 : mailbox.syncEveryMinutes,
    agentIds: mailbox === undefined ? [] : mailbox.agentIds,
    error: null,
})

/** Resolves the mailbox account fields from the current draft and saved connection. */
export const accountOf = (mailbox: ImapMailbox | undefined): ImapAccountValues | undefined =>
    mailbox === undefined
        ? undefined
        : {
              name: mailbox.name,
              email: mailbox.email,
              host: mailbox.host,
              port: String(mailbox.port),
              security: mailbox.security,
              user: mailbox.user,
              password: "",
          }

/** Builds the mailbox request from its current account and resumed credentials. */
export const requestOf = (state: ImapWizardState, values: ImapAccountValues, user: string) => {
    return () => ({
        ...(state.savedId === null ? {} : { connectionId: state.savedId }),
        name: values.name.trim(),
        email: values.email.trim(),
        host: values.host,
        port: Number(values.port),
        security: values.security,
        user,
        password: values.password,
    })
}
