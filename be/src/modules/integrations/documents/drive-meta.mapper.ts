import type { DriveFile } from "./documents.contracts"
import { fieldOf, textOf } from "./response-body.mapper"

/** The metadata of one Drive item, as far as reading needs it. */
export interface DriveMeta {
    /** The Drive id, when the answer names one. */
    readonly id: string | undefined
    /** The name. */
    readonly name: string | undefined
    /** The Drive type. */
    readonly mimeType: string | undefined
    /** The size in bytes as Drive writes it (a decimal text). */
    readonly size: string | undefined
    /** The last change. */
    readonly modifiedTime: string | undefined
    /** True when the item is in the trash. */
    readonly trashed: boolean
    /** The item a shortcut points at. */
    readonly targetId: string | undefined
}

/** One folder waiting to be listed. */
export interface FolderVisit {
    /** The Drive id of the folder. */
    readonly id: string
    /** The folders between the pasted folder and this one, joined by "/". */
    readonly path: string
    /** How many levels below the pasted folder it is. */
    readonly depth: number
}

/** The metadata in a Drive answer; every field that is missing or of the wrong type is absent. */
export const metaFrom = (value: unknown): DriveMeta => ({
    id: textOf(fieldOf(value, "id")),
    name: textOf(fieldOf(value, "name")),
    mimeType: textOf(fieldOf(value, "mimeType")),
    size: textOf(fieldOf(value, "size")),
    modifiedTime: textOf(fieldOf(value, "modifiedTime")),
    trashed: fieldOf(value, "trashed") === true,
    targetId: textOf(fieldOf(fieldOf(value, "shortcutDetails"), "targetId")),
})

/** A listed file from its metadata, the id it is listed under and the folders above it. */
export const fileOf = (meta: DriveMeta, id: string, path: string): DriveFile => ({
    id,
    name: meta.name ?? id,
    mimeType: meta.mimeType ?? "",
    size: meta.size === undefined ? null : Number(meta.size),
    modifiedTime: meta.modifiedTime ?? null,
    path,
})

/** A folder path with one more folder name. */
export const joined = (path: string, name: string): string => (path === "" ? name : `${path}/${name}`)
