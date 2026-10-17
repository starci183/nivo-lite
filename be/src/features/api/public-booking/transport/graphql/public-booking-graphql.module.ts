import { Module } from "@nestjs/common"
import { PublicBookingApiModule } from "../../public-booking.module"
import { ConfigurableModuleClass } from "./public-booking-graphql.module-definition"
import { PublicBookingPageResolver } from "./public-booking-page.resolver"
import { PublicBookingTimesResolver } from "./public-booking-times.resolver"
import { RequestPublicBookingResolver } from "./request-public-booking.resolver"

@Module({
    imports: [PublicBookingApiModule.register({})],
    providers: [PublicBookingPageResolver, PublicBookingTimesResolver, RequestPublicBookingResolver],
})
/** The GraphQL transport of the public-booking feature. */
export class PublicBookingGraphqlModule extends ConfigurableModuleClass {}
