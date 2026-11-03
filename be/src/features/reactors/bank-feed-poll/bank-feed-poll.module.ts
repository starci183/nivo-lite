import { Module } from "@nestjs/common"
import { StartBankFeedPollHandler } from "./application/start-bank-feed-poll.handler"
import { ConfigurableModuleClass } from "./bank-feed-poll.module-definition"

@Module({ providers: [StartBankFeedPollHandler] })
/** The bank-feed-poll reactor: the handler its consumer dispatches to. */
export class BankFeedPollReactorModule extends ConfigurableModuleClass {}
