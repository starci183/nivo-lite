/** What asking for an upload address of the caller's own picture takes. */
export interface RequestMyAvatarUploadRequest {
    /** The MIME type the browser reports. */
    readonly contentType: string
    /** The size in bytes. */
    readonly sizeBytes: number
}
