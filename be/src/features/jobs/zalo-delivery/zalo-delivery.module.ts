import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./zalo-delivery.module-definition"
import { ProcessZaloDeliveryStep } from "./steps/process-zalo-delivery.step"

@Module({
    providers: [ProcessZaloDeliveryStep],
    exports: [ProcessZaloDeliveryStep],
})
/** The zalo receipt job and its single processing step. */
export class ZaloDeliveryJobModule extends ConfigurableModuleClass {}
