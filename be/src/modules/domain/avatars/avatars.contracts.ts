import type { Outcome } from "@modules/platform/primitives"

/** What the browser says about the picture it wants to upload, checked before any upload address is issued. */
export interface AvatarFile {
    /** The MIME type the browser reports. */
    readonly contentType: string
    /** The size in bytes. */
    readonly sizeBytes: number
}

/** Whose picture an object is: a person's own, or an agent's that a manager set. */
export type AvatarOwner = "people" | "agents"

/** A one-time address the browser PUTs the picture to, and where the picture will be read once it is set. */
export interface AvatarUpload {
    /** The object path in the avatars bucket; the browser hands it back to set the picture. */
    readonly path: string
    /** The one-time token of the upload. */
    readonly token: string
    /** The signed address to PUT the picture to. */
    readonly signedUrl: string
    /** The public address the picture is read at (the live preview may show it once the upload finished). */
    readonly publicUrl: string
}

/** A path in the avatars bucket; null or absent drops the picture back to the default one. */
export type OptionalAvatarPath = string | null | undefined

/** The HTTPS address of an uploaded picture, or null for none. */
export type OptionalAvatarAddress = string | null

/** Where the person's uploaded picture is kept: their sign-in account. */
export interface AvatarAccounts {
    /** Keeps the uploaded picture (an HTTPS address) on the account, or drops it with null. */
    setUploadedAvatar(userId: string, avatarUrl: OptionalAvatarAddress): Promise<Outcome<true, string>>
}
