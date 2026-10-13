/** Workspace video brand fields persisted by the owner capability. */
export interface SaveVideoBrandKit {
    /** Shop name. */
    readonly shopName: string
    /** Main color. */
    readonly primary: string | null
    /** Second color. */
    readonly secondary: string | null
    /** Logo path. */
    readonly logoPath: string | null
    /** Music track. */
    readonly musicTrack: string | null
    /** Voice name. */
    readonly voice: string
}
