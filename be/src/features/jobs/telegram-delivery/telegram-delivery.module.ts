import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./telegram-delivery.module-definition"
import { ProcessTelegramDeliveryStep } from "./steps/process-telegram-delivery.step"

@Module({
    providers: [ProcessTelegramDeliveryStep],
    exports: [ProcessTelegramDeliveryStep],
})
/** The telegram receipt job and its single processing step. */
export class TelegramDeliveryJobModule extends ConfigurableModuleClass {}
