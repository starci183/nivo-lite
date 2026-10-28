import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./sweep-system-history.module-definition"
import { SweepSystemHistoryStep } from "./steps/sweep-system-history.step"

@Module({ providers: [SweepSystemHistoryStep], exports: [SweepSystemHistoryStep] })
/** The application of the sweep-system-history job: its step; the queue transport module imports it. */
export class SweepSystemHistoryModule extends ConfigurableModuleClass {}
