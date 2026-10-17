import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./check-connection-health.module-definition"
import { JudgeConnectionsStep } from "./steps/judge-connections.step"

@Module({ providers: [JudgeConnectionsStep], exports: [JudgeConnectionsStep] })
/** The application of the check-connection-health job: its step; the queue transport module imports it. */
export class CheckConnectionHealthModule extends ConfigurableModuleClass {}
