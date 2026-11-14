import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import type { ItemsRegionView } from "../../views/views.types"
import { coreReadsPort } from "../ports"
import { doneRowOf } from "../runs-done"

/** The most finished items the region lists. */
export const DONE_SHOWN = 5

/** `platform.agent-done`: what the agent finished lately (its runs that ended done, newest first), as the collapsed "done" region reads it. */
export const agentDoneRead: ReadDefinition = defineRead({
    id: "platform.agent-done",
    dataKind: "platform-agent-done",
    shape: "record",
    fields: ["count", "rows", "linkLabel", "linkHref", "more"],
    paths: { rows: "list" },
    variables: z.object({ agent: z.uuid().max(MAX_ID) }),
    permission: "platform.view",
    ports: { core: coreReadsPort },
    run: async ({ core }, { agent }): Promise<ItemsRegionView> => {
        const page = await core.runs.list({ agent, statuses: ["done"], order: "ended", size: DONE_SHOWN })
        const totals = await core.runs.count(agent, ["done"])
        const rows = page.rows.map((run) => doneRowOf(run))
        const total = totals.length === 0 ? rows.length : totals.reduce((sum, group) => sum + group.count, 0)
        return {
            count: total === 0 ? null : String(total),
            rows,
            linkLabel: "",
            linkHref: "",
            more: total > rows.length ? `+${String(total - rows.length)}` : null,
        }
    },
})
