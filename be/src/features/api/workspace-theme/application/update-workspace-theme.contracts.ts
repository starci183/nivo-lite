/** What saving the theme of the active workspace takes: the parameters only, validated by range and list before they are written. */
export interface UpdateWorkspaceThemeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves they own or manage it. */
    readonly workspaceId: string
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
    /** The mode the console opens in; absent or null follows the person's own choice. */
    readonly mode?: string | null | undefined
}
