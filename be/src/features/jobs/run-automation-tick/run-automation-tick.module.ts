import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./run-automation-tick.module-definition"
import { RunAutomationTickStep } from "./steps/tick.step"

@Module({ providers: [RunAutomationTickStep], exports: [RunAutomationTickStep] })
/** The application of the run-automation-tick job: its step; the queue transport module imports it. */
export class RunAutomationTickModule extends ConfigurableModuleClass {}
