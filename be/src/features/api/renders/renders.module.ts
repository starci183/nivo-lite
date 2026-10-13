import { Module } from "@nestjs/common"
import { RequestRenderHandler } from "./application/request-render.handler"
import { GetRenderStatusHandler } from "./application/get-render-status.handler"

@Module({ providers: [RequestRenderHandler, GetRenderStatusHandler] })
/** The renders feature: the handlers of its application. */
export class RendersApiModule {}
