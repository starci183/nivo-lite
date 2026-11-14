import type { DynamicModule } from "@nestjs/common"
import { AGENT_RUNS_NIVO_API_OPS } from "@features/api/agent-runs"
import { AGENT_WORK_NIVO_API_OPS } from "@features/api/agent-work"
import { AGENT_WORKFLOWS_NIVO_API_OPS } from "@features/api/agent-workflows"
import { BRAIN_GRAPH_NIVO_API_OPS } from "@features/api/brain-graph"
import { CONNECTIONS_NIVO_API_OPS } from "@features/api/connections"
import { CONTACTS_NIVO_API_OPS } from "@features/api/contacts"
import { MODULES_NIVO_API_OPS } from "@features/api/modules"
import { TEAM_CHAT_NIVO_API_OPS } from "@features/api/team-chat"
import { WORKBENCH_NIVO_API_OPS } from "@features/api/workbench"
import { WORKSPACE_THEME_NIVO_API_OPS } from "@features/api/workspace-theme"
import { NivoApiModule, type NivoApiOpGroup } from "@modules/domain/nivo-api"

/**
 * The features that declare NIVO data ops: each lists its ops and the application handlers they send to (the SAME handlers the ops'
 * GraphQL resolvers run: one code path, one rights guard), composed here once without their GraphQL transport. Only the exposed ops'
 * handlers: none of them runs a tool or a graph (a workflow start writes the wake the api's engine drains; a stop's answer and an
 * approval's verdict are recorded as the run's resume wake, which the api's engine drains and resumes).
 */
const MCP_NIVO_API_GROUPS: ReadonlyArray<NivoApiOpGroup> = [
    CONTACTS_NIVO_API_OPS,
    WORKBENCH_NIVO_API_OPS,
    TEAM_CHAT_NIVO_API_OPS,
    BRAIN_GRAPH_NIVO_API_OPS,
    WORKSPACE_THEME_NIVO_API_OPS,
    MODULES_NIVO_API_OPS,
    AGENT_WORKFLOWS_NIVO_API_OPS,
    AGENT_WORK_NIVO_API_OPS,
    AGENT_RUNS_NIVO_API_OPS,
    CONNECTIONS_NIVO_API_OPS,
]

/** The registry of the NIVO data ops the outbound MCP surface runs, with the handlers its features declare. */
export const nivoApiModules = (): Array<DynamicModule> => [NivoApiModule.register({ isGlobal: true, groups: MCP_NIVO_API_GROUPS })]
