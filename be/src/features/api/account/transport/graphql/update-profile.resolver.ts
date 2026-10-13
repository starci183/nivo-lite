import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpdateProfileCommand } from "../../application/update-profile.command"
import { toUpdateProfileRequest } from "./account-change.mapper"
import { UpdateProfileInput } from "./dto/update-profile.input"

@Resolver()
/** GraphQL door of renaming the caller. */
export class UpdateProfileResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /**
     * Carries the display name into every workspace the caller actively belongs to. The sign-in profile name is the
     * browser's own Auth call.
     */
    @Mutation(() => Boolean, { name: "updateProfile" })
    async updateProfile(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: UpdateProfileInput,
    ): Promise<boolean> {
        await this.commandBus.execute(new UpdateProfileCommand({ request: toUpdateProfileRequest(input), principal }))
        return true
    }
}
