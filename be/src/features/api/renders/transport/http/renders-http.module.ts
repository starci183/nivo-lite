import { Module } from "@nestjs/common"
import { RendersApiModule } from "../../renders.module"
import { RendersController } from "./renders.controller"

@Module({ imports: [RendersApiModule], controllers: [RendersController] })
/** The HTTP transport of the renders feature. */
export class RendersHttpModule {}
