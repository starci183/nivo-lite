import { Module } from "@nestjs/common"
import { RunFlowHandler } from "./application/run-flow.handler"
import { ConfigurableModuleClass } from "./flows.module-definition"

@Module({ providers: [RunFlowHandler] })
/** The flows feature: the handlers of its application. */
export class FlowsApiModule extends ConfigurableModuleClass {}
