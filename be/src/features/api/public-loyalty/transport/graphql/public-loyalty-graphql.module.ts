import { Module } from "@nestjs/common"
import { PublicLoyaltyApiModule } from "../../public-loyalty.module"
import { ConfigurableModuleClass } from "./public-loyalty-graphql.module-definition"
import { PublicLoyaltyPageResolver } from "./public-loyalty-page.resolver"
import { RequestLoyaltyCodeResolver } from "./request-loyalty-code.resolver"
import { VerifyLoyaltyCodeResolver } from "./verify-loyalty-code.resolver"

@Module({
    imports: [PublicLoyaltyApiModule.register({})],
    providers: [PublicLoyaltyPageResolver, RequestLoyaltyCodeResolver, VerifyLoyaltyCodeResolver],
})
/** The GraphQL transport of the public-loyalty feature. */
export class PublicLoyaltyGraphqlModule extends ConfigurableModuleClass {}
