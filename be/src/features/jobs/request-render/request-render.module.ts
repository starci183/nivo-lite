import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./request-render.module-definition"
import { RequestRenderStep } from "./steps/request-render.step"

@Module({ providers: [RequestRenderStep], exports: [RequestRenderStep] })
/** The application of the request-render job: its step; the queue transport module imports it. */
export class RequestRenderModule extends ConfigurableModuleClass {}
