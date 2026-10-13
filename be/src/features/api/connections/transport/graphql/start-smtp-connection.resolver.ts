import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { StartSmtpConnectionCommand } from "../../application/start-smtp-connection.command"
import { StartSmtpConnectionInput } from "./dto/start-smtp-connection.input"
import { SmtpConnectionType } from "./dto/smtp-connection.type"
import { toStartSmtpConnectionRequest, toStartSmtpConnectionType } from "./start-smtp-connection.mapper"

@Resolver()
/** GraphQL door of startSmtpConnection. */
export class StartSmtpConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Starts an outgoing email (SMTP) connection as pending. */
    @Mutation(() => SmtpConnectionType, { name: "startSmtpConnection" })
    async startSmtpConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: StartSmtpConnectionInput,
    ): Promise<SmtpConnectionType> {
        const result = await this.commandBus.execute(
            new StartSmtpConnectionCommand({ request: toStartSmtpConnectionRequest(workspaceId, input), principal }),
        )
        return toStartSmtpConnectionType(result)
    }
}
