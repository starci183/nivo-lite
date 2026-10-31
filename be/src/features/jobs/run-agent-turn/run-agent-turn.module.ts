import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./run-agent-turn.module-definition"
import { DrainStep } from "./steps/drain.step"

@Module({ providers: [DrainStep], exports: [DrainStep] })
/** The application of the run-agent-turn job: its step; the queue transport module imports it. */
export class RunAgentTurnModule extends ConfigurableModuleClass {}
