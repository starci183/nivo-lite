import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { IMAP_CONNECTION_TEXT, imapSummary } from "./messages/imap-connection.messages"
import type { ImapConfig, ImapParsedJson, ImapCredential, ImapInput, ImapSettings } from "./imap-connection.contracts"

/** The look-back choices for a first read, in days. */
export const SINCE_CHOICES: ReadonlyArray<number> = [7, 30, 90]

const EVERY_CHOICES: ReadonlyArray<number> = [15, 60, 360]
const DEFAULT_SINCE_DAYS = 30

const invalid = (detail: string): DataHubError =>
    new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail } })

const parseJson = (raw: string): ImapParsedJson => {
    try {
        const value: unknown = JSON.parse(raw)
        return { value, cause: null }
    } catch (cause) {
        return { value: null, cause }
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** Reads the stored credential JSON; throws a plain sentence when it is missing or broken. */
export const parseCredential = (raw: string): ImapCredential => {
    const { value } = parseJson(raw)
    if (
        isRecord(value) &&
        typeof value.host === "string" &&
        typeof value.user === "string" &&
        typeof value.password === "string" &&
        typeof value.port === "number"
    ) {
        return {
            host: value.host,
            port: value.port,
            secure: value.secure !== false,
            user: value.user,
            password: value.password,
        }
    }
    throw invalid(IMAP_CONNECTION_TEXT.credentialMissing)
}

/** Reads the saved settings from the public meta; a broken one falls back to INBOX and 30 days. */
export const parseConfig = (meta: Readonly<Record<string, string>>): ImapConfig => {
    const { value } = parseJson(meta.config ?? "{}")
    if (!isRecord(value)) return { folders: ["INBOX"], sinceDays: DEFAULT_SINCE_DAYS }
    const folders = Array.isArray(value.folders)
        ? value.folders
              .filter((entry): entry is string => typeof entry === "string" && entry.length > 0 && entry.length <= 200)
              .slice(0, 20)
        : []
    const days = value.sinceDays
    const sinceDays = typeof days === "number" && SINCE_CHOICES.includes(days) ? days : DEFAULT_SINCE_DAYS
    return { folders, sinceDays }
}

/** The typed server settings checked and turned into the credential; `savedPassword` fills a blank password. */
export const credentialFromInput = (input: ImapInput, savedPassword: string | null): ImapCredential => {
    const host = input.host.trim()
    const user = input.user.trim()
    if (host === "" || host.length > 253 || /[\s/]/u.test(host)) throw invalid(IMAP_CONNECTION_TEXT.hostInvalid)
    if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65_535) {
        throw invalid(IMAP_CONNECTION_TEXT.portInvalid)
    }
    if (input.security !== "tls" && input.security !== "starttls") throw invalid(IMAP_CONNECTION_TEXT.securityInvalid)
    if (user === "" || user.length > 320) throw invalid(IMAP_CONNECTION_TEXT.userMissing)
    const password = input.password === "" ? (savedPassword ?? "") : input.password
    if (password === "") throw invalid(IMAP_CONNECTION_TEXT.passwordMissing)
    return { host, port: input.port, secure: input.security === "tls", user, password }
}

/** Checks the name, folders, look-back and schedule of a save. */
export const settingsFromInput = (input: ImapInput): ImapSettings => {
    const name = input.name.trim()
    const email = input.email.trim()
    if (name === "" || name.length > 80) throw invalid(IMAP_CONNECTION_TEXT.nameInvalid)
    if (email.length > 320) throw invalid(IMAP_CONNECTION_TEXT.emailTooLong)
    const folders = [...new Set((input.folders ?? []).filter((folder) => folder !== "" && folder.length <= 200))].slice(
        0,
        20,
    )
    if (folders.length === 0) throw invalid(IMAP_CONNECTION_TEXT.folderMissing)
    const sinceDays = input.sinceDays ?? DEFAULT_SINCE_DAYS
    if (!SINCE_CHOICES.includes(sinceDays)) throw invalid(IMAP_CONNECTION_TEXT.sinceInvalid)
    const every = input.syncEveryMinutes ?? null
    if (every !== null && !EVERY_CHOICES.includes(every)) throw invalid(IMAP_CONNECTION_TEXT.everyInvalid)
    return { name, email, folders, sinceDays, every }
}

/** The public meta of a mailbox: its config JSON, a one-line summary and the address. */
export const metaFromSettings = (settings: ImapSettings): Readonly<Record<string, string>> => {
    const { folders, sinceDays, email } = settings
    const shown = folders.length > 2 ? `${folders.slice(0, 2).join(", ")} +${folders.length - 2}` : folders.join(", ")
    return {
        config: JSON.stringify({ folders, sinceDays }),
        summary: imapSummary(shown, sinceDays),
        email,
    }
}

/** The key under which a folder's cursor is kept in the public meta. */
export const cursorKey = (folder: string): string => `cursor:${folder}`
