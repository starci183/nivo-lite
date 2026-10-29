/** What a delivery of the event bus gives the inbox: the consumer's queue and the business key, claimed once per effect. */
export interface InboxClaim {
    /** The reactor's queue, the first half of the inbox key. */
    readonly consumer: string
    /** The business key of the fact, the second half. */
    readonly dedupeKey: string
}

/** The brand kit of the project's workspace; every field is null when the workspace saved none. */
export interface ProjectBrand {
    /** The shop name shown in the video. */
    readonly shopName: string | null
    /** The accent colour. */
    readonly primary: string | null
    /** The second colour. */
    readonly secondary: string | null
    /** The logo path in the media bucket. */
    readonly logoPath: string | null
    /** The music track id. */
    readonly musicTrack: string | null
    /** The voice name. */
    readonly voice: string | null
}

/** The project a caller asks to render with everything the spec needs, each part asked of the capability that owns it. */
export interface ProjectForRender {
    /** The project id. */
    readonly id: string
    /** The workspace it belongs to. */
    readonly workspaceId: string
    /** The output shape. */
    readonly aspect: string
    /** The project status. */
    readonly status: string
    /** The editable scenes, as stored. */
    readonly script: unknown
    /** The version the next render snapshots. */
    readonly version: number
    /** The status of the render the project points at, or null. */
    readonly renderStatus: string | null
    /** The workspace name. */
    readonly workspaceName: string
    /** The brand kit. */
    readonly brand: ProjectBrand
}

/** A render that was queued for a project. */
export interface RenderQueued {
    /** The new `video_renders` row. */
    readonly renderId: string
    /** The project it renders. */
    readonly projectId: string
}

/** The answer of reading one stored file: its bytes, or why they could not be read. */
export type AssetDownload =
    { readonly data: Blob; readonly error: null } | { readonly data: null; readonly error: Error }

/** The answer of writing an asset: no error when storage accepted the object. */
export interface AssetUpload {
    /** The storage failure, or null on success. */
    readonly error: Error | null
}

/** The file store the render job reads its assets from and writes the finished video to (a private bucket per kind, "<workspace_id>/..." paths). */
export interface VideoAssets {
    /** Reads one file of a bucket. */
    download(bucket: string, path: string): Promise<AssetDownload>
    /** Writes one file into a bucket, replacing an earlier one at the same path; `error` is null when it was stored. */
    upload(bucket: string, path: string, body: Buffer, contentType: string): Promise<AssetUpload>
}
