import { entityPort } from "@nivo-lite/agent-sdk/entity/port"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { agentGraphEntity } from "../../entities/agent/graph.entity"
import { agentRunEntity } from "../../entities/agent/run.entity"
import { agentRunStepEntity } from "../../entities/agent/run-step.entity"
import type {
    AgentConnections,
    AgentKnowledge,
    InstallationSource,
    MemberDirectory,
    ParkedRuns,
    RightsDirectory,
} from "./platform.types"

/** The installation of the app: the registry the back end runs and the modules the workspace has enabled. The door provides it. */
export const installationPort: PortDefinition<InstallationSource> =
    definePort<InstallationSource>("platform.installation")

/** The active seats of the workspace: who acts, by the name shown and whether they manage. The door provides it. */
export const membersPort: PortDefinition<MemberDirectory> = definePort<MemberDirectory>("platform.members")

/** The permissions the members of the workspace hold: owners and managers hold every one, staff those the workspace granted. The door provides it. */
export const rightsPort: PortDefinition<RightsDirectory> = definePort<RightsDirectory>("platform.rights")

/** The runs of the agents (`agent.run`): what the agent finished is read from them, through the engine. */
export const agentRuns: PortDefinition<EntityApi> = entityPort(agentRunEntity)

/** The steps of the runs of the agents (`agent.run-step`): the timeline of one run is read from them. */
export const agentRunSteps: PortDefinition<EntityApi> = entityPort(agentRunStepEntity)

/** The graphs of the agents (`agent.graph`): the one that holds an installation tells which agent it runs. */
export const agentGraphs: PortDefinition<EntityApi> = entityPort(agentGraphEntity)

/** The connections of the workspace bound to an agent. */
export const agentConnectionsPort: PortDefinition<AgentConnections> =
    definePort<AgentConnections>("platform.agent-connections")

/** The knowledge an agent reads and its open gaps. */
export const agentKnowledgePort: PortDefinition<AgentKnowledge> = definePort<AgentKnowledge>("platform.agent-knowledge")

/** The runs the engine parked and the resume of them. The door provides it, over the engine's park and resume of runs. */
export const parkedRunsPort: PortDefinition<ParkedRuns> = definePort<ParkedRuns>("platform.parked-runs")
