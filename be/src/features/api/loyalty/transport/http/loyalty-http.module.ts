import { Module } from "@nestjs/common"
import { LoyaltyApiModule } from "../../loyalty.module"
import { LoyaltyController } from "./loyalty.controller"

@Module({ imports: [LoyaltyApiModule], controllers: [LoyaltyController] })
/** The HTTP transport of the loyalty feature. */
export class LoyaltyHttpModule {}
