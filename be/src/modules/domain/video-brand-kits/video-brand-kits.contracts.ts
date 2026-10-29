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

/** The guideline colors and name a confirmed brand kit gives the video kit. */
export interface GuidelineVideoBrand {
    /** Main color, `#rrggbb` lower case. */
    readonly primary: string
    /** Second color, `#rrggbb` lower case. */
    readonly secondary: string
    /** The brand name; empty keeps the stored one. */
    readonly shopName: string
}

/** The logo and name of a workspace kit. */
export interface KitIdentity {
    /** The logo path in the media bucket, or null. */
    readonly logoPath: string | null
    /** The shop name; empty when unknown. */
    readonly shopName: string
}

/** The whole kit of a workspace as the video capability builds a render and the workbench from it. */
export interface VideoBrandKit {
    /** The shop name shown in the video; empty when none was saved. */
    readonly shopName: string
    /** The accent colour. */
    readonly primaryColor: string
    /** The second colour. */
    readonly secondaryColor: string
    /** The logo path in the media bucket, or null. */
    readonly logoPath: string | null
    /** The music track id, or null. */
    readonly musicTrack: string | null
    /** The voice name. */
    readonly voice: string
}

/** The kit of a workspace, or null when the workspace saved none. */
export type OptionalVideoBrandKit = VideoBrandKit | null
