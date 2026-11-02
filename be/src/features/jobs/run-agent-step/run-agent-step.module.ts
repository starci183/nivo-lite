import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./run-agent-step.module-definition"
import { AdvanceStep } from "./steps/advance.step"

@Module({ providers: [AdvanceStep], exports: [AdvanceStep] })
/** The application of the run-agent-step job: its step; the queue transport module imports it. */
export class RunAgentStepModule extends ConfigurableModuleClass {}
