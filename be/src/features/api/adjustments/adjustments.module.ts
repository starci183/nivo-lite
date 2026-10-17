import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./adjustments.module-definition"
import { CreateAccountingAdjustmentHandler } from "./application/create-accounting-adjustment.handler"

@Module({ providers: [CreateAccountingAdjustmentHandler] })
/** Registers the adjustments CQRS handlers. */
export class AdjustmentsApiModule extends ConfigurableModuleClass {}
