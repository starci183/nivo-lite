/** The facts about a media file that upload validation needs. */
export interface MediaFile {
    /** The original file name. */
    readonly name: string
    /** The MIME type supplied by the client. */
    readonly contentType: string
    /** The file size in bytes. */
    readonly sizeBytes: number
}

/** A stored media file available to the content workbench. */
export interface ContentLibraryFile {
    /** The source of this media reference. */
    readonly kind: "media"
    /** The object's workspace-scoped storage path. */
    readonly path: string
    /** The file name displayed to the user. */
    readonly name: string
}

/** A completed video available to the content workbench. */
export interface ContentMediaVideo {
    /** The video id. */
    readonly id: string
    /** The video name displayed to the user. */
    readonly name: string
    /** When the video was created, ISO 8601. */
    readonly createdAt: string
    /** The duration in milliseconds, when known. */
    readonly durationMs: number | null
}

/** Temporary links for viewing and downloading one media item. */
export interface ContentMediaUrl {
    /** The storage path or a video id prefixed with `video:`. */
    readonly key: string
    /** The URL used to view the media. */
    readonly view: string
    /** The URL used to download the media. */
    readonly download: string
}

/** The media library and links requested by the content workbench. */
export interface ContentMediaData {
    /** The listable files in the workspace's media folder. */
    readonly library: ReadonlyArray<ContentLibraryFile>
    /** The completed videos in the workspace. */
    readonly videos: ReadonlyArray<ContentMediaVideo>
    /** Temporary links for the requested files and videos. */
    readonly urls: ReadonlyArray<ContentMediaUrl>
}

/** The media items and library limit requested by the caller. */
export interface ContentMediaRequest {
    /** Workspace-scoped storage paths that need temporary links. */
    readonly paths: ReadonlyArray<string>
    /** Workspace video ids that need temporary links. */
    readonly videoIds: ReadonlyArray<string>
    /** The maximum number of library files to return. */
    readonly limit: number
}

/** The signed upload destination for a validated media file. */
export interface ContentMediaUpload {
    /** The object's workspace-scoped storage path. */
    readonly path: string
    /** The original file name displayed to the user. */
    readonly name: string
    /** The token authorizing the storage upload. */
    readonly token: string
    /** The URL used to upload the file. */
    readonly signedUrl: string
}
