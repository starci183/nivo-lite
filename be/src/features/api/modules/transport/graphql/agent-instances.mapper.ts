import type { ChannelChoice, CreateAgentInstanceRequest, CreatedAgent } from "@modules/domain/agent-instances"
import type { Locale } from "@modules/platform/i18n"
import type { AgentChannelChoicesRequest } from "../../application/agent-channel-choices.contracts"
import type { AgentChannelChoiceType } from "./dto/agent-channel-choice.type"
import type { AgentChannelChoicesInput } from "./dto/agent-channel-choices.input"
import type { CreateAgentInstallationInput } from "./dto/create-agent-installation.input"
import type { CreatedAgentInstallationType } from "./dto/created-agent-installation.type"

/** Maps the GraphQL input, with the workspace and language of the request, to the create request. */
export const toCreateAgentInstallationRequest = (
    workspaceId: string,
    input: CreateAgentInstallationInput,
    locale: Locale,
): CreateAgentInstanceRequest => ({
    workspaceId,
    moduleKey: input.moduleKey,
    locale,
    name: input.name,
    handle: input.handle,
    avatarPreset: input.avatarPreset,
    avatarPath: input.avatarPath,
    connectionIds: input.connectionIds,
    startFrom: input.startFrom,
    copyFrom: input.copyFrom,
    providerRights:
        input.providerRights === null
            ? null
            : input.providerRights.map((right) => ({
                  connectionId: right.connectionId,
                  abilities: Object.fromEntries(right.abilities.map((ability) => [ability.id, ability.mode])),
              })),
})

/** Maps the created agent to its GraphQL type. */
export const toCreatedAgentInstallationType = (created: CreatedAgent): CreatedAgentInstallationType => ({
    installationId: created.installationId,
    agentId: created.agentId,
    copied: created.copied,
    channels: created.channels,
})

/** Maps the GraphQL input, with the workspace it names, to the channel choices request. */
export const toAgentChannelChoicesRequest = (
    workspaceId: string,
    input: AgentChannelChoicesInput,
): AgentChannelChoicesRequest => ({ workspaceId, moduleKey: input.moduleKey })

/** Maps the channel choices to their GraphQL type. */
export const toAgentChannelChoicesType = (choices: ReadonlyArray<ChannelChoice>): Array<AgentChannelChoiceType> =>
    choices.map((choice) => ({ ...choice }))
