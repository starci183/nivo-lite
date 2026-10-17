import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./meta-delivery.module-definition"
import { ProcessMetaDeliveryStep } from "./steps/process-meta-delivery.step"

@Module({
    providers: [ProcessMetaDeliveryStep],
    exports: [ProcessMetaDeliveryStep],
})
/** The meta receipt job and its single processing step. */
export class MetaDeliveryJobModule extends ConfigurableModuleClass {}
