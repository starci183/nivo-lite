/** How an invitation left Auth: a new account invite email, a sign-in link, or not at all (copy the link). */
export type InviteSent = "invited" | "existing" | "none"

/** An address a browser may upload one object to once, without holding a credential. */
export interface SignedUpload {
    /** The object path the upload lands at. */
    readonly path: string
    /** The one-time token of the upload. */
    readonly token: string
    /** The signed address to PUT the object to. */
    readonly signedUrl: string
}

/** One object listed in a private bucket, without its bytes. */
export interface ListedObject {
    /** The file name relative to the requested folder. */
    readonly name: string
    /** When Storage recorded the object, when known. */
    readonly createdAt: string | null
}

/** A short-lived read address for one private object. */
export interface SignedObjectUrl {
    /** The object path in its bucket. */
    readonly path: string
    /** The address Storage signed. */
    readonly signedUrl: string
}

/** Why Storage refused: the object is not there, or the provider could not be reached (the values of the matching SupabaseErrorCode members). */
export type StorageFailureCode = "SUPABASE_OBJECT_NOT_FOUND" | "SUPABASE_PROVIDER_UNAVAILABLE"

/** One stored object read back. */
export interface StoredObject {
    /** The bytes. */
    readonly bytes: Uint8Array
    /** The content type Storage recorded. */
    readonly contentType: string
}

/** The HTTPS address of a picture a person uploaded, or null to keep none. */
export type UploadedAvatarUrl = string | null

/** One Supabase Auth account as the domains need it. */
export interface AuthAccount {
    /** The Auth user identifier. */
    readonly id: string
    /** The account email, empty when the account has none. */
    readonly email: string
    /** The last sign-in instant as Auth reports it. */
    readonly lastSignInAt: string | null
    /** The picture the team sees: the uploaded one, else the provider profile's. */
    readonly avatarUrl: string | null
    /** The HTTPS address of the picture the person uploaded, or null when they use the provider's or the generated one. */
    readonly uploadedAvatarUrl: string | null
    /** The name from the profile, else the email's local part. */
    readonly displayName: string
}
