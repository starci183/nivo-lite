import { Module } from "@nestjs/common"
import { AuthApiModule } from "../../auth.module"
import { ConfigurableModuleClass } from "./auth-graphql.module-definition"
import { ChangePasswordResolver } from "./change-password.resolver"
import { LogoutOtherSessionsResolver } from "./logout-other-sessions.resolver"

@Module({
    imports: [AuthApiModule.register({})],
    providers: [ChangePasswordResolver, LogoutOtherSessionsResolver],
})
/** The GraphQL transport of the auth feature: the doors that need a signed-in caller. */
export class AuthGraphqlModule extends ConfigurableModuleClass {}
