import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./vietcombank-delivery.module-definition"
import { ProcessVietcombankDeliveryStep } from "./steps/process-vietcombank-delivery.step"

@Module({
    providers: [ProcessVietcombankDeliveryStep],
    exports: [ProcessVietcombankDeliveryStep],
})
/** The vietcombank receipt job and its single processing step. */
export class VietcombankDeliveryJobModule extends ConfigurableModuleClass {}
