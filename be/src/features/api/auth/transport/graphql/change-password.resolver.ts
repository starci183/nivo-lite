import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ChangePasswordCommand } from "../../application/change-password.command"
import { toChangePasswordRequest } from "./auth-graphql.mapper"
import { ChangePasswordInput } from "./dto/change-password.input"

@Resolver()
/** GraphQL door of changing the caller password. */
export class ChangePasswordResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Changes the password of the signed-in person after they prove the current one. */
    @Mutation(() => Boolean, { name: "changePassword" })
    async changePassword(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: ChangePasswordInput,
    ): Promise<boolean> {
        await this.commandBus.execute(new ChangePasswordCommand({ request: toChangePasswordRequest(input), principal }))
        return true
    }
}
