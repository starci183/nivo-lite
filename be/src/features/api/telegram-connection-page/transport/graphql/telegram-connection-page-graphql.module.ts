import { Module } from "@nestjs/common"
import { TelegramConnectionPageApiModule } from "../../telegram-connection-page.module"
import { GetTelegramPageResolver } from "./get-telegram-page.resolver"
import { ListTelegramEventsResolver } from "./list-telegram-events.resolver"
import { ConfigurableModuleClass } from "./telegram-connection-page-graphql.module-definition"

@Module({
    imports: [TelegramConnectionPageApiModule.register({})],
    providers: [GetTelegramPageResolver, ListTelegramEventsResolver],
})
/** The GraphQL transport of the telegram-connection-page feature. */
export class TelegramConnectionPageGraphqlModule extends ConfigurableModuleClass {}
