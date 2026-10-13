import { Module } from "@nestjs/common"
import { AutomationsApiModule } from "../../automations.module"
import { AutomationsController } from "./automations.controller"

@Module({ imports: [AutomationsApiModule], controllers: [AutomationsController] })
/** The HTTP transport of the automations feature. */
export class AutomationsHttpModule {}
