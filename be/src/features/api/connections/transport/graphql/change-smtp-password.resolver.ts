import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ChangeSmtpPasswordCommand } from "../../application/change-smtp-password.command"
import { ChangeSmtpPasswordInput } from "./dto/change-smtp-password.input"
import { toChangeSmtpPasswordRequest } from "./change-smtp-password.mapper"

@Resolver()
/** GraphQL door of changeSmtpPassword. */
export class ChangeSmtpPasswordResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Replaces the password of an SMTP connection. */
    @Mutation(() => Boolean, { name: "changeSmtpPassword" })
    async changeSmtpPassword(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChangeSmtpPasswordInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new ChangeSmtpPasswordCommand({ request: toChangeSmtpPasswordRequest(workspaceId, input), principal }),
        )
        return true
    }
}
