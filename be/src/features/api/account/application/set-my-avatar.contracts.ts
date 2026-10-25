/** What setting or removing the caller's own picture takes. */
export interface SetMyAvatarRequest {
    /** The uploaded object path; null or absent removes the uploaded picture. */
    readonly path?: string | null | undefined
}
