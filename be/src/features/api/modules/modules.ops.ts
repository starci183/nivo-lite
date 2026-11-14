import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { NivoApiOpGroup } from "@modules/domain/nivo-api"
import { AgentDeletionImpactHandler } from "./application/agent-deletion-impact.handler"
import { AgentDeletionImpactQuery } from "./application/agent-deletion-impact.query"
import { ListInstallationsHandler } from "./application/list-installations.handler"
import { ListInstallationsQuery } from "./application/list-installations.query"

/** The installed agent ops of the outbound MCP surface: the message each op sends to the modules handlers, with those handlers. */
export const MODULES_NIVO_API_OPS: NivoApiOpGroup = {
    handlers: [ListInstallationsHandler, AgentDeletionImpactHandler],
    queries: {
        [NIVO_API.agent.list]: ListInstallationsQuery,
        [NIVO_API.agent.deletionImpact]: AgentDeletionImpactQuery,
    },
    commands: {},
}
