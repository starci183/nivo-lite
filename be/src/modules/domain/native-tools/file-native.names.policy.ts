import { TOOL } from "@nivo-lite/agent-sdk/names"

/** The ids of the file tools, by verb. */
export interface FileToolIds {
    /** The id of the tool that stores a file in a record's file field. */
    readonly put: typeof TOOL.filePut
    /** The id of the tool that attaches an already stored file to a record's file field. */
    readonly link: typeof TOOL.fileLink
    /** The id of the tool that issues a signed address for a stored file. */
    readonly get: typeof TOOL.fileGet
}

/** THE seam of the file tools: their ids, read from the names entry. Every other file of the file tools reads the ids from here. */
export const FILE_TOOL: FileToolIds = {
    /** Stores a file a provider tool staged, or the file at the address a provider answered, in a declared `file` field of a record. */
    put: TOOL.filePut,
    /** Attaches a file already in the store (a confirmed upload of that field, a staged file) to a declared `file` field of a record. */
    link: TOOL.fileLink,
    /** A short-lived signed address to read or send the file a record holds in a declared `file` field. */
    get: TOOL.fileGet,
} as const

/** The id of one file tool. */
export type FileToolId = (typeof FILE_TOOL)[keyof typeof FILE_TOOL]
