import { Module } from "@nestjs/common"
import { UsageApiModule } from "../../usage.module"
import { UsageController } from "./usage.controller"

@Module({
    imports: [UsageApiModule],
    controllers: [UsageController],
})
/** The HTTP transport of the usage feature. */
export class UsageHttpModule {}
