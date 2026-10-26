/** The picture types the avatars bucket accepts. */
export const AVATAR_TYPES: ReadonlyArray<string> = ["image/png", "image/jpeg", "image/webp"]

/** The native `accept` list of the picture picker (a hint to the picker; the bucket and the server check again). */
export const AVATAR_ACCEPT = AVATAR_TYPES.join(",")

/** The largest picture, in bytes (2 MB, the bucket's own limit). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/** Why a chosen picture cannot be uploaded: its type, or its size. */
export type AvatarProblem = "type" | "size"

/** What is wrong with a chosen picture before anything is sent, or null when it may be uploaded. */
export const avatarProblemOf = (file: File): AvatarProblem | null => {
    if (!AVATAR_TYPES.includes(file.type)) return "type"
    return file.size > 0 && file.size <= AVATAR_MAX_BYTES ? null : "size"
}

/** The one-time upload address the back end issued for a picture. */
export interface AvatarTicket {
    readonly path: string
    readonly signedUrl: string
}

/** The back end doors of one picture: ask for an upload address, keep or remove the picture, and read it again. */
export interface AvatarDoors {
    readonly request: (file: { readonly contentType: string; readonly sizeBytes: number }) => Promise<AvatarTicket>
    /** Keeps the uploaded path; null removes the picture. */
    readonly set: (path: string | null) => Promise<unknown>
    /** Reads the saved picture again once it changed. */
    readonly refresh: () => Promise<unknown>
    readonly savedMessage: string
    readonly removedMessage: string
}
