/** Where and how to log in to one mailbox. */
export interface ImapLogin {
    /** The server name or address the owner typed. */
    readonly host: string
    /** The server port. */
    readonly port: number
    /** True for implicit TLS, false for STARTTLS. */
    readonly secure: boolean
    /** The login name. */
    readonly user: string
    /** The password (an app password). */
    readonly password: string
}

/** One person on a message. */
export interface ImapAddress {
    /** The display name, if any. */
    readonly name: string | null
    /** The mail address, if any. */
    readonly address: string | null
}

/** One message as a hub row; structurally a data record. */
export interface ImapMessageRow {
    /** `<folder>:<uidvalidity>:<uid>`. */
    readonly externalId: string
    /** The subject. */
    readonly title: string
    /** When the message was sent (or received when it has no date). */
    readonly occurredAt: Date | null
    /** The message fields. */
    readonly data: Readonly<Record<string, unknown>>
}

/** One folder to read and where the last read stopped. */
export interface ImapFolderRequest {
    /** The folder path. */
    readonly path: string
    /** The saved cursor `<uidvalidity>:<uid>`, or null for a first read. */
    readonly cursor: string | null
}

/** What reading the folders is asked to do. */
export interface ImapPullRequest {
    /** The folders to read, in order. */
    readonly folders: ReadonlyArray<ImapFolderRequest>
    /** On a first read of a folder: only messages since this moment. */
    readonly since: Date
    /** True once the run's time budget is spent. */
    readonly isExpired: () => boolean
    /** Stores a batch of rows; answers how many were written. */
    readonly deliver: (rows: ReadonlyArray<ImapMessageRow>) => Promise<number>
}

/** What happened to one folder. */
export interface ImapFolderOutcome {
    /** The folder path. */
    readonly path: string
    /** The cursor to save, or null to leave the saved one. */
    readonly cursor: string | null
    /** How many rows were written. */
    readonly rows: number
    /** True when more new messages wait for the next run. */
    readonly more: boolean
    /** The plain-language failure of this folder, or null. */
    readonly failure: string | null
}

/** What reading the folders answered. */
export interface ImapPullResult {
    /** One outcome per folder that was reached. */
    readonly folders: ReadonlyArray<ImapFolderOutcome>
    /** True when the time budget ended the run early. */
    readonly expired: boolean
}
