import { Module } from "@nestjs/common"
import { GetTelegramPageHandler } from "./application/get-telegram-page.handler"
import { ListTelegramEventsHandler } from "./application/list-telegram-events.handler"
import { ConfigurableModuleClass } from "./telegram-connection-page.module-definition"

@Module({
    providers: [GetTelegramPageHandler, ListTelegramEventsHandler],
})
/** The telegram-connection-page feature: the handlers of the Telegram connection page operations. */
export class TelegramConnectionPageApiModule extends ConfigurableModuleClass {}
