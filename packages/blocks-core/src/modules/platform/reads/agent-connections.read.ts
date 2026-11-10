import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import type { ConnectionsRegionView } from "../../../views/views.types"
import { agentConnectionsPort } from "../ports"

/** `platform.agent-connections`: the accounts attached to the agent, read only, as the collapsed "connections" region reads them. */
export const agentConnectionsRead: ReadDefinition = defineRead({
    id: "platform.agent-connections",
    dataKind: "platform-agent-connections",
    shape: "record",
    fields: ["label", "rightsLabel", "rightsHref", "rows"],
    paths: { rows: "list" },
    variables: z.object({ agent: z.string().min(1).max(MAX_ID) }),
    permission: "platform.view",
    ports: { connections: agentConnectionsPort },
    run: ({ connections }, { agent }): Promise<ConnectionsRegionView> => connections.of(agent),
})
