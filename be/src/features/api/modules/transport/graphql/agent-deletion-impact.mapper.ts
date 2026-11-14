import type { AgentRemovalImpact } from "@modules/domain/modules"
import type { AgentDeletionImpactRequest } from "../../application/agent-deletion-impact.contracts"
import type { AgentDeletionImpactType } from "./dto/agent-deletion-impact.type"
import type { ModuleInstallationIdInput } from "./dto/module-installation-id.input"

/** Maps the installation of the GraphQL input, with the workspace it names, to the query request. */
export const toAgentDeletionImpactRequest = (
    workspaceId: string,
    input: ModuleInstallationIdInput,
): AgentDeletionImpactRequest => ({ workspaceId, installationId: input.installationId })

/** Maps what removing the agent takes with it to the GraphQL type. */
export const toAgentDeletionImpactType = (impact: AgentRemovalImpact): AgentDeletionImpactType => ({
    agentId: impact.agentId,
    files: impact.files,
    installationId: impact.installationId,
    recordTypes: impact.recordTypes.map(({ count, title, type }) => ({ count, title, type })),
    records: impact.records,
    channels: impact.channels.map(({ kind, name, provider, connectionId }) => ({ kind, name, provider, connectionId })),
})
