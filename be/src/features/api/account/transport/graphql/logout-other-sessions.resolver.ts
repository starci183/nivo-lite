import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { LogoutOtherSessionsCommand } from "../../application/logout-other-sessions.command"

@Resolver()
/** GraphQL door of signing the caller out of every other device. */
export class LogoutOtherSessionsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Ends every session of the signed-in person except the one this request runs on. */
    @Mutation(() => Boolean, { name: "logoutOtherSessions" })
    async logoutOtherSessions(@CurrentPrincipal() principal: Principal): Promise<boolean> {
        await this.commandBus.execute(new LogoutOtherSessionsCommand({ request: {}, principal }))
        return true
    }
}
