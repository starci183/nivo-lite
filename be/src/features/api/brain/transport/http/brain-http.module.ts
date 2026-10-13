import { Module } from "@nestjs/common"
import { BrainApiModule } from "../../brain.module"
import { BrainController } from "./brain.controller"

@Module({ imports: [BrainApiModule], controllers: [BrainController] })
/** The HTTP transport of the brain feature. */
export class BrainHttpModule {}
