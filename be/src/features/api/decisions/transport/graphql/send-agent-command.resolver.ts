import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { SendCommandCommand } from "../../application/send-command.command"
import { AgentCommandResultType } from "./dto/agent-command-result.type"
import { SendAgentCommandInput } from "./dto/send-agent-command.input"
import { toAgentCommandResultType, toSendCommandRequest } from "./decisions.mapper"

@Resolver()
/** GraphQL door of the agent command bus. */
export class SendAgentCommandResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sends a command to an agent (this also asks for a follow-up draft: to sales, command send_follow_up); a refusal is answered with its reason, not thrown. The queued item is polled with `workItem`. */
    @Mutation(() => AgentCommandResultType, { name: "sendAgentCommand" })
    async sendAgentCommand(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: SendAgentCommandInput,
    ): Promise<AgentCommandResultType> {
        const result = await this.commandBus.execute(
            new SendCommandCommand({ request: toSendCommandRequest(workspaceId, input, locale), principal }),
        )
        return toAgentCommandResultType(result)
    }
}
