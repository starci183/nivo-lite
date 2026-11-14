import { TOOL } from "@nivo-lite/agent-sdk/names"

/** The ids of the record tools, by verb. */
export interface RecordToolIds {
    /** The id of the tool that reads one record. */
    readonly get: typeof TOOL.recordGet
    /** The id of the tool that lists a page of records. */
    readonly list: typeof TOOL.recordList
    /** The id of the tool that creates a record. */
    readonly create: typeof TOOL.recordCreate
    /** The id of the tool that changes a record. */
    readonly update: typeof TOOL.recordUpdate
}

/** The ids of the record tools, from the vocabulary every package and the gateway read; every file of the record tools reads them from here. */
export const RECORD_TOOL: RecordToolIds = {
    /** One record of the calling agent, by id. */
    get: TOOL.recordGet,
    /** One page of the calling agent's records of a type, filtered on its indexed fields. */
    list: TOOL.recordList,
    /** Creates one record of a declared record type, stamped with the calling agent. */
    create: TOOL.recordCreate,
    /** Changes the fields of one of the calling agent's records. */
    update: TOOL.recordUpdate,
} as const

/** The id of one record tool. */
export type RecordToolId = (typeof RECORD_TOOL)[keyof typeof RECORD_TOOL]
