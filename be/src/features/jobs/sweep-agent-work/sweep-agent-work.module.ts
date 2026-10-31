import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./sweep-agent-work.module-definition"
import { SweepAgentWorkStep } from "./steps/sweep-agent-work.step"

@Module({ providers: [SweepAgentWorkStep], exports: [SweepAgentWorkStep] })
/** The application of the sweep-agent-work job: its step; the queue transport module imports it. */
export class SweepAgentWorkModule extends ConfigurableModuleClass {}
