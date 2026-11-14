import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { AcceptedLocale, type Locale } from "@modules/platform/i18n"
import { AgentChannelChoicesQuery } from "../../application/agent-channel-choices.query"
import { CreateAgentInstallationCommand } from "../../application/create-agent-installation.command"
import {
    toAgentChannelChoicesRequest,
    toAgentChannelChoicesType,
    toCreateAgentInstallationRequest,
    toCreatedAgentInstallationType,
} from "./agent-instances.mapper"
import { AgentChannelChoiceType } from "./dto/agent-channel-choice.type"
import { AgentChannelChoicesInput } from "./dto/agent-channel-choices.input"
import { CreateAgentInstallationInput } from "./dto/create-agent-installation.input"
import { CreatedAgentInstallationType } from "./dto/created-agent-installation.type"

@Resolver()
/** GraphQL doors of one role, many agents: the channels a new agent could answer, and creating the agent. */
export class CreateAgentInstallationResolver {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** The channel connections a new agent of the role could answer, each with the agent of the role that answers it already. */
    @Query(() => [AgentChannelChoiceType], { name: "agentChannelChoices" })
    async agentChannelChoices(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AgentChannelChoicesInput,
    ): Promise<Array<AgentChannelChoiceType>> {
        const result = await this.queryBus.execute(
            new AgentChannelChoicesQuery({ request: toAgentChannelChoicesRequest(workspaceId, input), principal }),
        )
        return toAgentChannelChoicesType(result)
    }

    /** Creates one more agent of a role with its name, handle, picture and channels, from the default setup or a sibling's. */
    @Mutation(() => CreatedAgentInstallationType, { name: "createAgentInstallation" })
    async createAgentInstallation(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: CreateAgentInstallationInput,
    ): Promise<CreatedAgentInstallationType> {
        const result = await this.commandBus.execute(
            new CreateAgentInstallationCommand({
                request: toCreateAgentInstallationRequest(workspaceId, input, locale),
                principal,
            }),
        )
        return toCreatedAgentInstallationType(result)
    }
}
