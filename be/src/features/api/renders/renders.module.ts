import { Module } from "@nestjs/common"
import { RequestRenderHandler } from "./application/request-render.handler"

@Module({ providers: [RequestRenderHandler] })
/** The renders feature: the handlers of its application. */
export class RendersApiModule {}
