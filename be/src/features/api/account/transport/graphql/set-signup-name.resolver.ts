import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { SetSignupNameCommand } from "../../application/set-signup-name.command"
import { toSetSignupNameRequest } from "./account-change.mapper"
import { SetSignupNameInput } from "./dto/set-signup-name.input"

@Resolver()
/** GraphQL door of keeping the name typed at sign-up. */
export class SetSignupNameResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /**
     * Keeps the full name on the account the sign-up door just created. It acts only on an unconfirmed account that has no name,
     * and answers true whether or not it did, so it never says whether an address has an account.
     */
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    @Mutation(() => Boolean, { name: "setSignupName" })
    async setSignupName(@Args("input") input: SetSignupNameInput): Promise<boolean> {
        await this.commandBus.execute(new SetSignupNameCommand({ request: toSetSignupNameRequest(input) }))
        return true
    }
}
