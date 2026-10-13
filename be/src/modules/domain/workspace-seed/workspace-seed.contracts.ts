/** One account the demo workspace needs. */
export interface SeedAccount {
    /** The sign-in email. */
    readonly email: string
    /** The display name. */
    readonly name: string
    /** The password to set; the command keeps it in the operator's secrets file, never in output. */
    readonly password: string
}

/** What a seed run takes. */
export interface SeedRequest {
    /** The owner account. */
    readonly owner: SeedAccount
    /** The staff account. */
    readonly staff: SeedAccount
}

/** What a seed run answers. */
export interface SeedReport {
    /** The workspace that was seeded. */
    readonly workspaceId: string
    /** One line per thing done, ready to print (no credentials). */
    readonly lines: ReadonlyArray<string>
}
