import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import type { ConnectionsRegionView, KnowledgeRegionView } from "../../../views/views.types"
import { PLATFORM_VIEW } from "../constants"
import { agentConnectionsPort, agentGraphs, agentKnowledgePort } from "../ports"
import { agentOfInstallation } from "./agent-run-scope"

/** What the two reads take: the installation of the route, and the module whose tabs the links of the regions open. */
const variables: z.ZodObject<{ installation: z.ZodUUID; module: z.ZodString }> = z.object({
    installation: z.uuid(),
    module: z.string().min(1).max(MAX_ID),
})

/** The workspace path of one tab of the agent page. */
export const agentTabPath = (module: string, installation: string, tab: string): string =>
    `/agents/${module}/${installation}/${tab}`

/** The region shown while the installation has no agent: no connection, nothing known. */
const NO_CONNECTIONS: Pick<ConnectionsRegionView, "rows"> = { rows: [] }

/** `platform.installation-connections`: the connections the agent of an installation acts through, with the link to its Connections tab. */
export const installationConnectionsRead: ReadDefinition = defineRead({
    id: "platform.installation-connections",
    dataKind: "platform-agent-connections",
    shape: "record",
    fields: ["manageLabel", "manageHref", "rows"],
    paths: { rows: "list" },
    variables,
    permission: PLATFORM_VIEW,
    ports: { graphs: agentGraphs, connections: agentConnectionsPort },
    run: async ({ graphs, connections }, given): Promise<ConnectionsRegionView> => {
        const agent = await agentOfInstallation(graphs, given.installation)
        const region = agent === null ? { manageLabel: "", ...NO_CONNECTIONS } : await connections.of(agent)
        return { ...region, manageHref: agentTabPath(given.module, given.installation, "connections") }
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
    ports: { graphs: agentGraphs, knowledge: agentKnowledgePort },
    run: async ({ graphs, knowledge }, given): Promise<KnowledgeRegionView> => {
        const agent = await agentOfInstallation(graphs, given.installation)
        const region = agent === null ? NO_KNOWLEDGE : await knowledge.of(agent)
        const href = agentTabPath(given.module, given.installation, "knowledge")
        return {
            ...region,
            openHref: href,
            gaps: region.gaps === null ? null : { ...region.gaps, openHref: href },
        }
    },
})
