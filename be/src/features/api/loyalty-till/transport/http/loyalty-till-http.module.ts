import { Module } from "@nestjs/common"
import { LoyaltyTillApiModule } from "../../loyalty-till.module"
import { LoyaltyTillController } from "./loyalty-till.controller"

@Module({ imports: [LoyaltyTillApiModule], controllers: [LoyaltyTillController] })
/** The HTTP transport of the loyalty-till feature. */
export class LoyaltyTillHttpModule {}
