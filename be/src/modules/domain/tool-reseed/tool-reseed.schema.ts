import { z } from "zod"

/** The longest tool id (an id is bounded at 200 wherever one is taken) and the most renames one file holds (the file renames about 140 tools today). */
const TOOL_ID_MAX = 200
const RENAMES_MAX = 2000

/** The rename file: a `tools` table of old id to new id, each id and the table bounded. */
export const renameFileSchema = z.object({
    tools: z
        .record(z.string().min(1).max(TOOL_ID_MAX), z.string().min(1).max(TOOL_ID_MAX))
        .refine((renames) => Object.keys(renames).length <= RENAMES_MAX),
})
