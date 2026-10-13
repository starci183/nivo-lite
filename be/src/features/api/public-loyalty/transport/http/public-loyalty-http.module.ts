import { Module } from "@nestjs/common"
import { PublicLoyaltyApiModule } from "../../public-loyalty.module"
import { PublicLoyaltyController } from "./public-loyalty.controller"

@Module({ imports: [PublicLoyaltyApiModule], controllers: [PublicLoyaltyController] })
/** The HTTP transport of the public-loyalty feature. */
export class PublicLoyaltyHttpModule {}
