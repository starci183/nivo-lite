import { Module } from "@nestjs/common"
import { RequestRenderHandler } from "./application/request-render.handler"
import { GetRenderStatusHandler } from "./application/get-render-status.handler"
import { ConfigurableModuleClass } from "./renders.module-definition"

@Module({ providers: [RequestRenderHandler, GetRenderStatusHandler] })
/** The renders feature: the handlers of its application. */
export class RendersApiModule extends ConfigurableModuleClass {}
