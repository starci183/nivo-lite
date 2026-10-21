/** What the command line gives a cleanup, as parsed: every field may be absent. */
export interface CleanupCommand {
    /** The comma-separated ids of the workspaces to keep. */
    readonly keep?: string
    /** True writes the receipt and deletes nothing. */
    readonly dryRun?: boolean
    /** True deletes, after a fresh dry run whose digest matches `receiptDigest`. */
    readonly execute?: boolean
    /** The digest of the reviewed dry-run receipt. */
    readonly receiptDigest?: string
    /** True lets an account delete cascade-delete kept rows; the receipt then lists those rows. */
    readonly allowKeptCascade?: boolean
}

/** Which way a cleanup runs. */
export type CleanupMode = "dry-run" | "execute"

/** One kept workspace in the receipt. */
export interface KeptWorkspace {
    /** The workspace id. */
    readonly id: string
    /** The workspace name. */
    readonly name: string
}

/** One workspace the cleanup removes, with what goes with it. */
export interface RemovedWorkspace {
    /** The workspace id. */
    readonly id: string
    /** The workspace name. */
    readonly name: string
    /** The row count of each cascading table, by table name. */
    readonly rows: Readonly<Record<string, number>>
    /** The sum of the row counts. */
    readonly total: number
}

/** One account no kept workspace holds. */
export interface OrphanUser {
    /** The Auth user id. */
    readonly id: string
    /** The sign-in email, masked to its first letter and its domain, or null when there is none. */
    readonly email: string | null
    /** The kept rows deleting the account cascade-deletes, by `<table>.<column>`; empty unless `--allow-kept-cascade`. */
    readonly keptCascade: Readonly<Record<string, number>>
}

/** What deleting one account would do to the data that survives the cleanup, by `<table>.<column>`. */
export interface UserReferences {
    /** Rows an ON DELETE CASCADE key would delete with the account. */
    readonly cascade: Readonly<Record<string, number>>
    /** Rows an ON DELETE NO ACTION key would refuse the delete for. */
    readonly block: Readonly<Record<string, number>>
}

/** The dry-run receipt the owner reviews; its digest is the sha256 of its canonical JSON. */
export interface CleanupReceipt {
    /** The receipt schema id. */
    readonly schema: string
    /** The kept workspaces, by id. */
    readonly keep: ReadonlyArray<KeptWorkspace>
    /** The workspaces to remove, by id. */
    readonly remove: ReadonlyArray<RemovedWorkspace>
    /** The accounts to remove, by id. */
    readonly orphanUsers: ReadonlyArray<OrphanUser>
    /** Tables the cascade empties too but the footprint cannot count. */
    readonly uncounted: ReadonlyArray<string>
    /** Whether account deletes may cascade-delete kept rows (`--allow-kept-cascade`). */
    readonly allowKeptCascade: boolean
}

/** What a cleanup answers, and prints after the receipt prefix. */
export interface CleanupReport {
    /** Which way it ran. */
    readonly mode: CleanupMode
    /** The sha256 of the canonical receipt JSON. */
    readonly digest: string
    /** The receipt. */
    readonly receipt: CleanupReceipt
    /** The accounts deleted, in order (none on a dry run). */
    readonly deletedUsers: ReadonlyArray<string>
    /** The accounts still to delete after a failed delete stopped the run (none on a dry run or a full run). */
    readonly remainingUsers: ReadonlyArray<string>
}
