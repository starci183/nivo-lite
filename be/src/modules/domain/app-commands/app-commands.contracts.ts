/** One ask of the web app, as the job that serves it reads it. */
export interface AppCommand {
    /** The command id. */
    readonly id: string
    /** The workspace it concerns, when any. */
    readonly workspaceId: string | null
    /** The signed-in person who asked; the job acts as them. */
    readonly requestedBy: string
    /** What was asked: `invite.create`, `invite.resend`, `invite.link`, `admin.invite.resend` or `video.render`. */
    readonly kind: string
    /** What the asker typed, as the request function stored it. */
    readonly input: Readonly<Record<string, unknown>>
}

/** What a finished command leaves for the web app to read: named fields the kind defines, stored as JSON. */
export interface AppCommandResult {
    readonly [field: string]: unknown
}

/** The command `begin` claimed, or null when it is unknown or already settled and nothing should run. */
export type OptionalAppCommand = AppCommand | null
