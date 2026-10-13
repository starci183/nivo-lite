import { Module } from "@nestjs/common"
import { RunFlowHandler } from "./application/run-flow.handler"

@Module({ providers: [RunFlowHandler] })
/** The flows feature: the handlers of its application. */
export class FlowsApiModule {}
