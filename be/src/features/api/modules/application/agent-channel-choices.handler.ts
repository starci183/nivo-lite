import { QueryHandler } from "@nestjs/cqrs"
import { AgentInstanceCreationService, type ChannelChoice } from "@modules/domain/agent-instances"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentChannelChoicesQuery } from "./agent-channel-choices.query"

@QueryHandler(AgentChannelChoicesQuery)
/** Answers the channel choices of a role from the agent instance creation service. */
export class AgentChannelChoicesHandler extends ICQRSHandler<AgentChannelChoicesQuery, ReadonlyArray<ChannelChoice>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly creation: AgentInstanceCreationService,
    ) {
        super(logger)
    }

    protected override process(query: AgentChannelChoicesQuery): Promise<ReadonlyArray<ChannelChoice>> {
        return this.creation.channelChoices(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.moduleKey,
        )
    }
}
