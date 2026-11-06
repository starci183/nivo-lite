import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { PLATFORM_VIEW } from "../constants"
import { MAX_ID, MAX_LINE } from "../../../bounds"
import type { ParkedRunRow } from "../platform.types"
import { parkedRunsPort } from "../ports"

/** The most parked runs a read lists when it names no limit. */
export const PARKED_DEFAULT = 20

/** The most parked runs a read lists at all. */
export const PARKED_MAX = 100

/** What `platform.parked-runs` answers. */
interface ParkedRunsView {
    /** How many parked runs match, as text; null when none. */
    readonly count: string | null
    /** The newest ones, at most the limit. */
    readonly rows: ReadonlyArray<ParkedRunRow>
}

/** `platform.parked-runs`: the runs the engine parked, newest first, narrowed by module and by the record they are about. */
export const parkedRunsRead: ReadDefinition = defineRead({
    id: "platform.parked-runs",
    dataKind: "platform-parked-runs",
    shape: "record",
    fields: ["count", "rows"],
    paths: { rows: "list" },
    variables: z.object({
        module: z.string().min(1).max(MAX_ID).optional(),
        subjectKind: z.string().min(1).max(MAX_LINE).optional(),
        subjectId: z.string().min(1).max(MAX_ID).optional(),
        limit: z.number().int().min(1).max(PARKED_MAX).default(PARKED_DEFAULT),
    }),
    permission: PLATFORM_VIEW,
    ports: { parked: parkedRunsPort },
    run: async ({ parked }, { limit, ...filter }): Promise<ParkedRunsView> => {
        const found = await parked.list(filter, limit)
        return { count: found.total === 0 ? null : String(found.total), rows: found.rows }
    },
})
