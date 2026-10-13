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
