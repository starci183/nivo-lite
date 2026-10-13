import { Module } from "@nestjs/common"
import { BillingApiModule } from "../../billing.module"
import { BillingController } from "./billing.controller"

@Module({
    imports: [BillingApiModule],
    controllers: [BillingController],
})
/** The HTTP transport of the billing feature. */
export class BillingHttpModule {}
