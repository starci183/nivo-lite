import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import type { ItemsRegionView } from "../../../views/views.types"
import { agentDonePort } from "../ports"

/** The most finished items the region lists. */
export const DONE_SHOWN = 5

/** `platform.agent-done`: what the agent finished lately, as the collapsed "done" region reads it. */
export const agentDoneRead: ReadDefinition = defineRead({
    id: "platform.agent-done",
    dataKind: "platform-agent-done",
    shape: "record",
    fields: ["count", "rows", "linkLabel", "linkHref", "more"],
    paths: { rows: "list" },
    variables: z.object({ agent: z.string().min(1).max(MAX_ID) }),
    permission: "platform.view",
    ports: { done: agentDonePort },
    run: async ({ done }, { agent }): Promise<ItemsRegionView> => {
        const recent = await done.recent(agent, DONE_SHOWN)
        return {
            count: recent.total === 0 ? null : String(recent.total),
            rows: recent.rows,
            linkLabel: "",
            linkHref: "",
            more: recent.total > recent.rows.length ? `+${String(recent.total - recent.rows.length)}` : null,
        }
    },
})
