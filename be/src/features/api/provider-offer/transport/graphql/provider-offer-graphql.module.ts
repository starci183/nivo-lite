import { Module } from "@nestjs/common"
import { ProviderOfferApiModule } from "../../provider-offer.module"
import { ConfigurableModuleClass } from "./provider-offer-graphql.module-definition"
import { GetProviderOfferResolver } from "./get-provider-offer.resolver"

@Module({
    imports: [ProviderOfferApiModule.register({})],
    providers: [GetProviderOfferResolver],
})
/** The GraphQL transport of the provider offer. */
export class ProviderOfferGraphqlModule extends ConfigurableModuleClass {}
