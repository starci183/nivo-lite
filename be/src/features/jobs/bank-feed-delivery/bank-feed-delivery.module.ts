import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./bank-feed-delivery.module-definition"
import { ProcessBankFeedDeliveryStep } from "./steps/process-bank-feed-delivery.step"

@Module({
    providers: [ProcessBankFeedDeliveryStep],
    exports: [ProcessBankFeedDeliveryStep],
})
/** The bank-feed receipt job and its single processing step. */
export class BankFeedDeliveryJobModule extends ConfigurableModuleClass {}
