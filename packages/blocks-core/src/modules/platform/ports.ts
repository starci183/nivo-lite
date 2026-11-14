import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { definePort, type PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { AgentRunRow } from "./agent-runs"
import type { AgentDesk } from "./platform.types"

export {
    CORE_READS_PORT_ID,
    agentConnectionsPort,
    agentKnowledgePort,
    coreReadsPort,
    installationPort,
    membersPort,
    parkedRunsPort,
    rightsPort,
} from "@nivo-lite/agent-sdk/platform"

/** The port `platform.agent-runs` declares as the list it pages, so a host pages it with a cursor; the read itself runs on the core reads. */
export const agentRunsList: PortDefinition<ListSource<AgentRunRow>> =
    definePort<ListSource<AgentRunRow>>("platform.agent-runs-list")

/** The id the back end serves the agent's work desk under (`AGENT_DESK_PORT_ID` of its `platform-ports`). */
export const AGENT_DESK_PORT_ID = "platform.agent-desk"

/**
 * The agent's work desk: how it works (its active workflows), what waits on a person and the verdict on it, the facts of its runs,
 * today's counts and what it may touch. The door provides it, scoped to the member who reads; every method takes the installation.
 */
export const agentDeskPort: PortDefinition<AgentDesk> = definePort<AgentDesk>(AGENT_DESK_PORT_ID)
