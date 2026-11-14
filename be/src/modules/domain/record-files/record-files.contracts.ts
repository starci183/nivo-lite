/** One declared `file` field of one record: what an upload, a confirmation, a link or a put is for. The workspace travels beside it. */
export interface RecordFileTarget {
    /** The record type, as its package declares it (`blocks-core.video.project`). */
    readonly type: string
    /** The record id. */
    readonly recordId: string
    /** The declared `file` field. */
    readonly field: string
    /**
     * The object key of one file of a list field (`field.file({ many: true })`): which item `url` signs and `delete` removes. Required
     * for a list field (`ItemKeyRequired`); on a single field it must name the file the field holds, or nothing is read or removed.
     */
    readonly key?: string
    /**
     * The agent whose own records the call may reach (a node's file tool: the calling agent); absent for a person's call, which reaches
     * every record of the workspace. A record of another agent is `RecordNotFound`, as one of another workspace is.
     */
    readonly agentId?: string
}

/** What a caller says of the file it is about to upload. */
export interface RecordFileFacts {
    /** The file name shown and offered on download. */
    readonly name: string
    /** The content type the upload will carry. */
    readonly mime: string
    /** The exact size in bytes. */
    readonly size: number
}

/** A ticket to upload one file: PUT the bytes to `url` with `headers` before `expiresAt`, then confirm `key`. */
export interface RecordFileTicket {
    /** The object key to confirm once the upload is done. */
    readonly key: string
    /** The presigned address. */
    readonly url: string
    /** The HTTP method the address is signed for. */
    readonly method: "PUT"
    /** The headers the upload must send unchanged. */
    readonly headers: Readonly<Record<string, string>>
    /** When the address stops working, ISO-8601. */
    readonly expiresAt: string
}

/** A short-lived signed read address of the file a record holds in one field, with what the reference says of it. */
export interface RecordFileUrl {
    /** The presigned address. */
    readonly url: string
    /** When it stops working, ISO-8601. */
    readonly expiresAt: string
    /** The file name. */
    readonly name: string
    /** The content type. */
    readonly mime: string
    /** The size in bytes. */
    readonly size: number
}

/** What a tool hands over to put on a record: an object it staged in the workspace, and the name to keep. */
export interface StagedFile {
    /** The staged object key (`<workspaceId>/staged/<objectId>`), as `RecordFilesService.stage` answered it. */
    readonly staged: string
    /** The file name to keep. */
    readonly name: string
    /** A list field: the object key of the item this file takes the place of (same position; the old object is removed). */
    readonly replaces?: string
}

/** What a provider's result is: the public https address of a file it produced, and the name to keep. */
export interface RemoteFile {
    /** The address to fetch the file from, once, server-side. */
    readonly url: string
    /** The file name to keep. */
    readonly name: string
    /** A list field: the object key of the item this file takes the place of (same position; the old object is removed). */
    readonly replaces?: string
}

/** What `RecordFilesService.put` takes: a staged object or a provider's address. */
export type PutFile = StagedFile | RemoteFile

/** An object already in the store to attach to a record's field: a confirmed upload of that field, or a staged object. */
export interface ObjectFile {
    /** The object key. */
    readonly key: string
    /** The file name to keep. */
    readonly name: string
    /** A list field: the object key of the item this file takes the place of (same position; the old object is removed). */
    readonly replaces?: string
}

/** What a delete did: whether the field held the reference (or the named item) that is now cleared (its object removed). */
export interface RecordFileRemoval {
    /** True when the field held a reference, or the named item. */
    readonly removed: boolean
}
