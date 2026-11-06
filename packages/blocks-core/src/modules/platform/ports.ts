import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type {
    AgentConnections,
    AgentDone,
    AgentKnowledge,
    InstallationSource,
    MemberDirectory,
    RightsDirectory,
} from "./platform.types"

/** The installation of the app: the registry the back end runs and the modules the workspace has enabled. The door provides it. */
export const installationPort: PortDefinition<InstallationSource> =
    definePort<InstallationSource>("platform.installation")

/** The active seats of the workspace: who acts, by the name shown and whether they manage. The door provides it. */
export const membersPort: PortDefinition<MemberDirectory> = definePort<MemberDirectory>("platform.members")

/** The permissions the members of the workspace hold: owners and managers hold every one, staff those the workspace granted. The door provides it. */
export const rightsPort: PortDefinition<RightsDirectory> = definePort<RightsDirectory>("platform.rights")

/** What the agents finished (the agent's work log of the workspace). */
export const agentDonePort: PortDefinition<AgentDone> = definePort<AgentDone>("platform.agent-done")

/** The connections of the workspace bound to an agent. */
export const agentConnectionsPort: PortDefinition<AgentConnections> =
    definePort<AgentConnections>("platform.agent-connections")

/** The knowledge an agent reads and its open gaps. */
export const agentKnowledgePort: PortDefinition<AgentKnowledge> = definePort<AgentKnowledge>("platform.agent-knowledge")
