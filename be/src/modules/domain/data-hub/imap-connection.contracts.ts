/** How the mailbox connection is secured. */
export type ImapSecurity = "tls" | "starttls"

/** The encrypted credential of one mailbox (the JSON shape rows already hold). */
export interface ImapCredential {
    /** The server name or address. */
    readonly host: string
    /** The server port. */
    readonly port: number
    /** True for implicit TLS, false for STARTTLS. */
    readonly secure: boolean
    /** The login name. */
    readonly user: string
    /** The app password. */
    readonly password: string
}

/** The non-secret settings, kept in public meta as ONE JSON string under `config`. */
export interface ImapConfig {
    /** The folders to read. */
    readonly folders: ReadonlyArray<string>
    /** How many days back a first read goes. */
    readonly sinceDays: number
}

/** What the wizard sends for a mailbox. */
export interface ImapInput {
    /** The connection being edited; absent for a new one. */
    readonly connectionId?: string | null
    /** The connection name. */
    readonly name: string
    /** The mailbox address. */
    readonly email: string
    /** The IMAP server. */
    readonly host: string
    /** The IMAP port. */
    readonly port: number
    /** The kind of security. */
    readonly security: string
    /** The login name. */
    readonly user: string
    /** The app password; blank on an existing connection keeps the saved one. */
    readonly password: string
    /** The folders to read. */
    readonly folders?: ReadonlyArray<string> | null | undefined
    /** How many days back a first read goes. */
    readonly sinceDays?: number | null | undefined
    /** Minutes between scheduled syncs; null is manual only. */
    readonly syncEveryMinutes?: number | null | undefined
}

/** What the wizard may know about a saved mailbox: never the password. */
export interface ImapView {
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

/** The result of reading a JSON text: the value, or null with the cause when it is broken. */
export interface ImapParsedJson {
    /** The parsed value, or null when the text is not JSON. */
    readonly value: unknown
    /** Why parsing failed; null when it worked. */
    readonly cause: unknown
}

/** The checked settings of a save. */
export interface ImapSettings {
    /** The connection name. */
    readonly name: string
    /** The mailbox address. */
    readonly email: string
    /** The folders to read. */
    readonly folders: ReadonlyArray<string>
    /** How many days back a first read goes. */
    readonly sinceDays: number
    /** Minutes between scheduled syncs; null is manual only. */
    readonly every: number | null
}
