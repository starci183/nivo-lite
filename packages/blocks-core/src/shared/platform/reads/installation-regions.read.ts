import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import type { ConnectionsRegionView, KnowledgeRegionView } from "../../views/views.types"
import { PLATFORM_VIEW } from "../constants"
import { agentConnectionsPort, agentKnowledgePort, coreReadsPort } from "../ports"

/** What the two reads take: the installation of the route, and the module whose tabs the links of the regions open. */
const variables: z.ZodObject<{ installation: z.ZodUUID; module: z.ZodString }> = z.object({
    installation: z.uuid(),
    module: z.string().min(1).max(MAX_ID),
})

/** The workspace path of one tab of the agent page. */
export const agentTabPath = (module: string, installation: string, tab: string): string =>
    `/agents/${module}/${installation}/${tab}`

/** The region shown while the installation has no agent: no provider attached. */
const NO_CONNECTIONS: Omit<ConnectionsRegionView, "rightsHref"> = { label: "", rightsLabel: "", rows: [] }

/** `platform.installation-connections`: the providers attached to the agent of an installation, with the link to its rights (Connections tab). */
export const installationConnectionsRead: ReadDefinition = defineRead({
    id: "platform.installation-connections",
    dataKind: "platform-agent-connections",
    shape: "record",
    fields: ["label", "rightsLabel", "rightsHref", "rows"],
    paths: { rows: "list" },
    variables,
    permission: PLATFORM_VIEW,
    ports: { core: coreReadsPort, connections: agentConnectionsPort },
    run: async ({ core, connections }, given): Promise<ConnectionsRegionView> => {
        const agent = await core.agentOf(given.installation)
        const region = agent === null ? NO_CONNECTIONS : await connections.of(agent)
        return { ...region, rightsHref: agentTabPath(given.module, given.installation, "connections") }
    },
})

/** The knowledge region of an agent that is not there: it knows nothing and has no gap. */
const NO_KNOWLEDGE: KnowledgeRegionView = {
    openLabel: "",
    openHref: "",
    footer: "",
    publicTitle: "",
    publicDescription: "",
    internalTitle: "",
    internalDescription: "",
    gaps: null,
}

/** `platform.installation-knowledge`: what the agent of an installation knows and its open gaps, with the link to its Knowledge tab. */
export const installationKnowledgeRead: ReadDefinition = defineRead({
    id: "platform.installation-knowledge",
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
    variables,
    permission: PLATFORM_VIEW,
    ports: { core: coreReadsPort, knowledge: agentKnowledgePort },
    run: async ({ core, knowledge }, given): Promise<KnowledgeRegionView> => {
        const agent = await core.agentOf(given.installation)
        const region = agent === null ? NO_KNOWLEDGE : await knowledge.of(agent)
        const href = agentTabPath(given.module, given.installation, "knowledge")
        return {
            ...region,
            openHref: href,
            gaps: region.gaps === null ? null : { ...region.gaps, openHref: href },
        }
    },
})
