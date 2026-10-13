import { Module } from "@nestjs/common"
import { GetLoyaltyPageHandler } from "./application/get-loyalty-page.handler"
import { RequestLoyaltyCodeHandler } from "./application/request-loyalty-code.handler"
import { VerifyLoyaltyCodeHandler } from "./application/verify-loyalty-code.handler"

@Module({
    providers: [GetLoyaltyPageHandler, RequestLoyaltyCodeHandler, VerifyLoyaltyCodeHandler],
})
/** The public-loyalty feature: the handlers of its application. */
export class PublicLoyaltyApiModule {}
