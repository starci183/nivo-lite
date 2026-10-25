import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetMyAvatarCommand } from "../../application/set-my-avatar.command"
import { toSetMyAvatarRequest } from "./account-change.mapper"
import { SetMyAvatarInput } from "./dto/set-my-avatar.input"

@Resolver()
/** GraphQL door that sets or removes the caller's own picture. */
export class SetMyAvatarResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Keeps the uploaded picture on the caller's account; a null path removes it (back to the default avatar). */
    @Mutation(() => Boolean, { name: "setMyAvatar" })
    async setMyAvatar(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: SetMyAvatarInput,
    ): Promise<boolean> {
        await this.commandBus.execute(new SetMyAvatarCommand({ request: toSetMyAvatarRequest(input), principal }))
        return true
    }
}
