import { Module } from "@nestjs/common"
import { AdjustmentsApiModule } from "../../adjustments.module"
import { ConfigurableModuleClass } from "./adjustments-graphql.module-definition"
import { CreateAccountingAdjustmentResolver } from "./create-accounting-adjustment.resolver"

@Module({ imports: [AdjustmentsApiModule.register({})], providers: [CreateAccountingAdjustmentResolver] })
/** The GraphQL doors of the adjustments feature. */
export class AdjustmentsGraphqlModule extends ConfigurableModuleClass {}
