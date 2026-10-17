import { Module } from "@nestjs/common"
import { AccountApiModule } from "../../account.module"
import { ConfigurableModuleClass } from "./account-graphql.module-definition"
import { MyAccountResolver } from "./my-account.resolver"
import { RevokeSessionResolver } from "./revoke-session.resolver"
import { UpdateProfileResolver } from "./update-profile.resolver"

@Module({
    imports: [AccountApiModule.register({})],
    providers: [MyAccountResolver, RevokeSessionResolver, UpdateProfileResolver],
})
/** The GraphQL transport of the account feature. */
export class AccountGraphqlModule extends ConfigurableModuleClass {}
