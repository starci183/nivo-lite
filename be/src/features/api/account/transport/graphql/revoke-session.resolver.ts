import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RevokeSessionCommand } from "../../application/revoke-session.command"
import { toRevokeSessionRequest } from "./account-change.mapper"
import { RevokeSessionInput } from "./dto/revoke-session.input"

@Resolver()
/** GraphQL door of signing another device out. */
export class RevokeSessionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Signs another device of the account out; the device this request runs on is refused. */
    @Mutation(() => Boolean, { name: "revokeSession" })
    async revokeSession(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: RevokeSessionInput,
    ): Promise<boolean> {
        await this.commandBus.execute(new RevokeSessionCommand({ request: toRevokeSessionRequest(input), principal }))
        return true
    }
}
