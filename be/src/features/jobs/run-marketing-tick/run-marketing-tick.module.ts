import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./run-marketing-tick.module-definition"
import { RunMarketingTickStep } from "./steps/run.step"

@Module({ providers: [RunMarketingTickStep], exports: [RunMarketingTickStep] })
/** The application of the run-marketing-tick job: its step; the queue transport module imports it. */
export class RunMarketingTickModule extends ConfigurableModuleClass {}
