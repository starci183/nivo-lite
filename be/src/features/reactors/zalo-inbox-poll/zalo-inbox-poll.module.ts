import { Module } from "@nestjs/common"
import { StartZaloInboxPollHandler } from "./application/start-zalo-inbox-poll.handler"
import { ConfigurableModuleClass } from "./zalo-inbox-poll.module-definition"

@Module({ providers: [StartZaloInboxPollHandler] })
/** The zalo-inbox-poll reactor: the handler its consumer dispatches to. */
export class ZaloInboxPollReactorModule extends ConfigurableModuleClass {}
