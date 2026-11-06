import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import type { KnowledgeRegionView } from "../../../views/views.types"
import { agentKnowledgePort } from "../ports"

/** `platform.agent-knowledge`: what the agent knows and its open gaps, as the collapsed "knowledge" region reads them. */
export const agentKnowledgeRead: ReadDefinition = defineRead({
    id: "platform.agent-knowledge",
    dataKind: "platform-agent-knowledge",
    shape: "record",
    fields: [
        "openLabel",
        "openHref",
        "footer",
        "publicTitle",
        "publicDescription",
        "internalTitle",
        "internalDescription",
        "gaps",
    ],
    paths: {},
    variables: z.object({ agent: z.string().min(1).max(MAX_ID) }),
    permission: "platform.view",
    ports: { knowledge: agentKnowledgePort },
    run: ({ knowledge }, { agent }): Promise<KnowledgeRegionView> => knowledge.of(agent),
})
