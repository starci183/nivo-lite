import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./run-automation-command.module-definition"
import { RunCommandStep } from "./steps/run-command.step"

@Module({ providers: [RunCommandStep], exports: [RunCommandStep] })
/** The application of the run-automation-command job: its step; the queue transport module imports it. */
export class RunAutomationCommandModule extends ConfigurableModuleClass {}
