import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./watch-agent-graphs.module-definition"
import { WatchAgentGraphsStep } from "./steps/watch-agent-graphs.step"

@Module({ providers: [WatchAgentGraphsStep], exports: [WatchAgentGraphsStep] })
/** The application of the watch-agent-graphs job: its step; the queue transport module imports it. */
export class WatchAgentGraphsModule extends ConfigurableModuleClass {}
