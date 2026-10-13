import { Module } from "@nestjs/common"
import { CreateAccountingAdjustmentHandler } from "./application/create-accounting-adjustment.handler"

@Module({ providers: [CreateAccountingAdjustmentHandler] })
/** Registers the adjustments CQRS handlers. */
export class AdjustmentsApiModule {}
