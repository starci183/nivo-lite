import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./replenish-stock.module-definition"
import { ReplenishStep } from "./steps/replenish.step"

@Module({ providers: [ReplenishStep], exports: [ReplenishStep] })
/** The application of the replenish-stock job: its step; the queue transport module imports it. */
export class ReplenishStockModule extends ConfigurableModuleClass {}
