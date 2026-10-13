import { Module } from "@nestjs/common"
import { RenderStep } from "./steps/render.step"

@Module({ providers: [RenderStep], exports: [RenderStep] })
/** The application of the render-video job: its step; the queue transport module imports it. */
export class RenderVideoModule {}
