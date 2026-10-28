import { Module } from "@nestjs/common"
import { GetZaloPageHandler } from "./application/get-zalo-page.handler"
import { ListZaloEventsHandler } from "./application/list-zalo-events.handler"
import { RecheckZaloConnectionHandler } from "./application/recheck-zalo-connection.handler"
import { SendZaloTestHandler } from "./application/send-zalo-test.handler"
import { ConfigurableModuleClass } from "./zalo-connection-page.module-definition"

@Module({
    providers: [GetZaloPageHandler, ListZaloEventsHandler, RecheckZaloConnectionHandler, SendZaloTestHandler],
})
/** The zalo-connection-page feature: the handlers of the Zalo connection page operations. */
export class ZaloConnectionPageApiModule extends ConfigurableModuleClass {}
