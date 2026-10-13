import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetDefaultSmtpCommand } from "../../application/set-default-smtp.command"
import { SetDefaultSmtpInput } from "./dto/set-default-smtp.input"
import { toSetDefaultSmtpRequest } from "./set-default-smtp.mapper"

@Resolver()
/** GraphQL door of setDefaultSmtp. */
export class SetDefaultSmtpResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Makes a connected SMTP connection the default sender. */
    @Mutation(() => Boolean, { name: "setDefaultSmtp" })
    async setDefaultSmtp(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetDefaultSmtpInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetDefaultSmtpCommand({ request: toSetDefaultSmtpRequest(workspaceId, input), principal }),
        )
        return true
    }
}
