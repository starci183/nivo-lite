import { Module } from "@nestjs/common"
import { OfficeApiModule } from "../../office.module"
import { OfficeCommandsController } from "./office-commands.controller"
import { OfficeThreadController } from "./office-thread.controller"

@Module({
    imports: [OfficeApiModule],
    controllers: [OfficeCommandsController, OfficeThreadController],
})
/** The HTTP transport of the office feature. */
export class OfficeHttpModule {}
