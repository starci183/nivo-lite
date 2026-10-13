import { Module } from "@nestjs/common"
import { AdjustmentsApiModule } from "../../adjustments.module"
import { CreateAccountingAdjustmentResolver } from "./create-accounting-adjustment.resolver"

@Module({ imports: [AdjustmentsApiModule], providers: [CreateAccountingAdjustmentResolver] })
/** The GraphQL doors of the adjustments feature. */
export class AdjustmentsGraphqlModule {}
