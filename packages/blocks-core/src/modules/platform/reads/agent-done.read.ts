import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import type { ItemsRegionView } from "../../../views/views.types"
import { agentRuns } from "../ports"
import { doneRowOf } from "../runs-done"

/** The most finished items the region lists. */
export const DONE_SHOWN = 5

/** The fields of a run the region reads. */
const RUN_FIELDS: ReadonlyArray<string> = ["trigger", "endedAt"]

/** `platform.agent-done`: what the agent finished lately (its runs that ended done, newest first), as the collapsed "done" region reads it. */
export const agentDoneRead: ReadDefinition = defineRead({
    id: "platform.agent-done",
    dataKind: "platform-agent-done",
    shape: "record",
    fields: ["count", "rows", "linkLabel", "linkHref", "more"],
    paths: { rows: "list" },
    variables: z.object({ agent: z.uuid().max(MAX_ID) }),
    permission: "platform.view",
    ports: { runs: agentRuns },
    run: async ({ runs }, { agent }): Promise<ItemsRegionView> => {
        const where = q.and(q.eq("agentId", agent), q.eq("status", "done"))
        const page = await runs.list({
            select: RUN_FIELDS,
            where,
            order: [
                ["endedAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: DONE_SHOWN },
        })
        const totals = await runs.aggregate({ where, measures: { count: { kind: "count" } }, limit: 1 })
        const rows = page.rows.map((listed) => doneRowOf(listed.row))
        const counted = totals[0]?.measures["count"]
        const total = typeof counted === "number" ? counted : rows.length
        return {
            count: total === 0 ? null : String(total),
            rows,
            linkLabel: "",
            linkHref: "",
            more: total > rows.length ? `+${String(total - rows.length)}` : null,
        }
    },
})
