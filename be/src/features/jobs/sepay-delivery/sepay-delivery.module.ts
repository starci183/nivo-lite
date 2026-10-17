import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./sepay-delivery.module-definition"
import { ProcessSepayDeliveryStep } from "./steps/process-sepay-delivery.step"

@Module({
    providers: [ProcessSepayDeliveryStep],
    exports: [ProcessSepayDeliveryStep],
})
/** The sepay receipt job and its single processing step. */
export class SepayDeliveryJobModule extends ConfigurableModuleClass {}
