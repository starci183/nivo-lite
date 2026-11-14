/** The three facts the core keeps about a workspace beside its billing: what the console header draws and what every node plans its days in. */
export interface WorkspaceSettings {
    /** The workspace name. */
    readonly name: string
    /** The IANA time zone in which the workspace's day, week and month begin. */
    readonly timeZone: string
    /** The public HTTPS address of the logo, or null while the workspace has none. */
    readonly logoUrl: string | null
}

/** What a change of the settings carries; a member left out stays as it is. */
export interface WorkspaceSettingsChange {
    /** The new name (1 to 120 characters once trimmed). */
    readonly name?: string
    /** The new IANA time zone; a name the platform does not know is refused. */
    readonly timeZone?: string
    /** The new logo as an HTTPS address, or null to remove the logo. */
    readonly logoUrl?: string | null
}

/** What a manager sends to change the settings: the logo goes by the object path an upload address named. */
export interface WorkspaceSettingsEdit {
    /** The new name. */
    readonly name?: string
    /** The new IANA time zone. */
    readonly timeZone?: string
    /** The path an upload address named, or null to remove the logo. */
    readonly logoPath?: string | null
}

/** What a caller sends to change the settings: a member left out, undefined or (name, time zone) null stays as it is. */
export interface WorkspaceSettingsRequestedEdit {
    /** The new name. */
    readonly name?: string | null | undefined
    /** The new IANA time zone. */
    readonly timeZone?: string | null | undefined
    /** The path an upload address named, or null to remove the logo. */
    readonly logoPath?: string | null | undefined
}

/** What the browser says about the logo it wants to upload. */
export interface WorkspaceLogoFile {
    /** The MIME type the browser reports. */
    readonly contentType: string
    /** The size in bytes. */
    readonly sizeBytes: number
}

/** A one-time address the browser PUTs the logo to, and where the logo is read once it is saved. */
export interface WorkspaceLogoUpload {
    /** The object path; the browser hands it back to save the logo. */
    readonly path: string
    /** The one-time token of the upload. */
    readonly token: string
    /** The signed address to PUT the picture to. */
    readonly signedUrl: string
    /** The public address the logo is read at. */
    readonly publicUrl: string
}

/** Where a workspace logo is kept: the app root binds the core's public picture store (the avatars service). */
export interface WorkspaceLogos {
    /** Issues an upload address for the logo of a workspace; an owner or a manager only. */
    requestWorkspaceUpload(userId: string, workspaceId: string, file: WorkspaceLogoFile): Promise<WorkspaceLogoUpload>
    /** The public HTTPS address of an uploaded logo, from the path an upload address named; refuses a path it did not issue. */
    workspaceLogoAddressOf(path: string): string
}

/**
 * The brand theme of a workspace in the parameters of the HeroUI theme builder (hue in degrees, chroma and lightness of the accent in
 * oklch, base = how much the neutrals lean to the hue). The core stores the parameters only; the console derives every colour from them.
 */
export interface WorkspaceTheme {
    /** The accent hue, 0 to 360. */
    readonly hue: number
    /** The accent chroma, 0 to 0.37. */
    readonly chroma: number
    /** The accent lightness as a fraction, 0.2 to 0.95. */
    readonly lightness: number
    /** How much the neutrals lean to the hue, 0 to 1. */
    readonly base: number
    /** One of the curated fonts. */
    readonly font: string
    /** One of the corner steps. */
    readonly radius: string
    /** The mode the console opens in; null follows the person's own choice. */
    readonly mode: string | null
}

/** A request to save the theme: `workspaceId` names the workspace, every other member is the theme. */
export interface WorkspaceThemeRequest {
    /** The workspace the theme is saved for. */
    readonly workspaceId: string
}
