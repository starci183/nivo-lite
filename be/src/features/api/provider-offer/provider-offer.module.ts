import { Module } from "@nestjs/common"
import { GetProviderOfferHandler } from "./application/get-provider-offer.handler"
import { ConfigurableModuleClass } from "./provider-offer.module-definition"

@Module({
    providers: [GetProviderOfferHandler],
})
/** The provider offer feature: the documentation of a provider's three levels for its page. */
export class ProviderOfferApiModule extends ConfigurableModuleClass {}
