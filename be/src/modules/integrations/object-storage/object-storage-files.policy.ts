/*
 * The ONE file store of the records (BIZ-MOVE G3): one private bucket for every file a declared record type keeps, and the key law
 * that ties each object to its workspace, record type, record and field. No vertical names a bucket of its own for a record's file.
 */

/** The purpose of the one bucket every record file lives in (`<prefix>-records`). */
export const RECORD_FILES_BUCKET = "records"

/** How long an upload address of a record file stays valid. */
export const FILE_UPLOAD_SECONDS = 900

/** How long a read link of a record file lives when the caller names no other lifetime. */
export const FILE_LINK_SECONDS = 3600

/**
 * The longest a read link of a record file may live: seven days, the most a SigV4 presigned address can carry (the store signs with its
 * static access key, so no key lifetime shortens it). A caller asks for a longer life with an explicit lifetime; the default stays short.
 */
export const FILE_LINK_MAX_SECONDS = 604_800

/** The folder of the objects a tool produced before they are put on a record; never a record type (those carry a dot). */
export const STAGED_FOLDER = "staged"

/** One field of one record: where its file lives. */
export interface RecordFileSpot {
    /** The workspace that owns the record. */
    readonly workspaceId: string
    /** The record type, as its package declares it (`video.project`). */
    readonly type: string
    /** The record id. */
    readonly recordId: string
    /** The declared `file` field. */
    readonly field: string
}

/** A uuid, as the store mints object ids and the engine record ids. */
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u

/** True for a lower-case uuid. */
export const isObjectId = (id: string): boolean => UUID.test(id)

/**
 * The folder of one field of one record: `<workspaceId>/<type>/<recordId>/<field>/`. The workspace leads, so the plan's storage
 * measure (first segment = the workspace) counts the files of the records like every other workspace object.
 */
export const recordFileFolderOf = (spot: RecordFileSpot): string =>
    `${spot.workspaceId}/${spot.type}/${spot.recordId}/${spot.field}/`

/** The key of one object of one field of one record: its folder, then the object id the store minted. */
export const recordFileKeyOf = (spot: RecordFileSpot, objectId: string): string => `${recordFileFolderOf(spot)}${objectId}`

/** True when `key` is an object of exactly this field of this record of this workspace: its folder, then one object id. */
export const isRecordFileKeyOf = (spot: RecordFileSpot, key: string): boolean => {
    const folder = recordFileFolderOf(spot)
    return key.startsWith(folder) && isObjectId(key.slice(folder.length))
}

/** The key of an object a tool produced for the workspace, before a node puts it on a record: `<workspaceId>/staged/<objectId>`. */
export const stagedKeyOf = (workspaceId: string, objectId: string): string => `${workspaceId}/${STAGED_FOLDER}/${objectId}`

/** True when `key` is a staged object of this workspace. */
export const isStagedKeyOf = (workspaceId: string, key: string): boolean => {
    const folder = `${workspaceId}/${STAGED_FOLDER}/`
    return key.startsWith(folder) && isObjectId(key.slice(folder.length))
}

/** The lifetime of a read link: the asked one, whole seconds, at least one and at most seven days; the default (one hour) when none is asked. */
export const linkSecondsOf = (asked: number | undefined): number =>
    asked === undefined || !Number.isFinite(asked)
        ? FILE_LINK_SECONDS
        : Math.min(FILE_LINK_MAX_SECONDS, Math.max(1, Math.floor(asked)))
