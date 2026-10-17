import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./generate-with-agent.module-definition"
import { GenerateWithAgentStep } from "./steps/generate-with-agent.step"

@Module({ providers: [GenerateWithAgentStep], exports: [GenerateWithAgentStep] })
/** The application of the generate-with-agent job: its step; the queue transport module imports it. */
export class GenerateWithAgentModule extends ConfigurableModuleClass {}
