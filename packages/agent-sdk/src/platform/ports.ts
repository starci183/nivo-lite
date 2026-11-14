import { definePort, type PortDefinition } from "../port"
import type {
    AgentConnections,
    AgentKnowledge,
    CoreReads,
    CustomerMessages,
    InstallationSource,
    MemberDirectory,
    ParkedRuns,
    RightsDirectory,
    RouteHolds,
} from "./platform.types"

/** The installation of the app: the registry the back end runs and the modules the workspace has enabled. The door provides it. */
export const installationPort: PortDefinition<InstallationSource> =
    definePort<InstallationSource>("platform.installation")

/** The active seats of the workspace: who acts, by the name shown and whether they manage. The door provides it. */
export const membersPort: PortDefinition<MemberDirectory> = definePort<MemberDirectory>("platform.members")

/** The permissions the members of the workspace hold: owners and managers hold every one, staff those the workspace granted. The door provides it. */
export const rightsPort: PortDefinition<RightsDirectory> = definePort<RightsDirectory>("platform.rights")

/** The id the back end serves the core reads under. */
export const CORE_READS_PORT_ID = "platform.core"

/**
 * What a read reads of the core of the engine: the agent an installation runs and the runs of the agents with their steps (core tables
 * of the engine, never records of a module). The door provides it, scoped to the workspace of the read.
 */
export const coreReadsPort: PortDefinition<CoreReads> = definePort<CoreReads>(CORE_READS_PORT_ID)

/** The id the back end serves the conversation with the customers under. */
export const CUSTOMER_MESSAGES_PORT_ID = "platform.customer-messages"

/**
 * The conversation with the customers, both directions, every agent's lines and the members' typed replies (the engine's core store),
 * read-only and bounded: by route or by person. The door provides it, scoped to the workspace of the read or the service call.
 */
export const customerMessagesPort: PortDefinition<CustomerMessages> = definePort<CustomerMessages>(CUSTOMER_MESSAGES_PORT_ID)

/** The id the back end serves the staff holds on customer routes under. */
export const ROUTE_HOLDS_PORT_ID = "platform.route-holds"

/** The staff hold on a customer's route (ruling R43): take, read, hand back. The door provides it, scoped to the workspace and the run's member. */
export const routeHoldsPort: PortDefinition<RouteHolds> = definePort<RouteHolds>(ROUTE_HOLDS_PORT_ID)

/** The connections of the workspace bound to an agent. */
export const agentConnectionsPort: PortDefinition<AgentConnections> =
    definePort<AgentConnections>("platform.agent-connections")

/** The knowledge an agent reads and its open gaps. */
export const agentKnowledgePort: PortDefinition<AgentKnowledge> = definePort<AgentKnowledge>("platform.agent-knowledge")

/** The runs the engine parked and the resume of them. The door provides it, over the engine's park and resume of runs. */
export const parkedRunsPort: PortDefinition<ParkedRuns> = definePort<ParkedRuns>("platform.parked-runs")
