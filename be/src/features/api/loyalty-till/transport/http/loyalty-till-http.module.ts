import { Module } from "@nestjs/common"
import { LoyaltyTillApiModule } from "../../loyalty-till.module"
import { ConfigurableModuleClass } from "./loyalty-till-http.module-definition"
import { LoyaltyTillController } from "./loyalty-till.controller"

@Module({ imports: [LoyaltyTillApiModule.register({})], controllers: [LoyaltyTillController] })
/** The HTTP transport of the loyalty-till feature. */
export class LoyaltyTillHttpModule extends ConfigurableModuleClass {}
