import { Module } from "@nestjs/common"
import { ZaloConnectionPageApiModule } from "../../zalo-connection-page.module"
import { ConfigurableModuleClass } from "./zalo-connection-page-graphql.module-definition"
import { GetZaloPageResolver } from "./get-zalo-page.resolver"
import { ListZaloEventsResolver } from "./list-zalo-events.resolver"
import { RecheckZaloConnectionResolver } from "./recheck-zalo-connection.resolver"
import { SaveZnsRenewalResolver } from "./save-zns-renewal.resolver"
import { SendZaloTestResolver } from "./send-zalo-test.resolver"

@Module({
    imports: [ZaloConnectionPageApiModule.register({})],
    providers: [
        GetZaloPageResolver,
        ListZaloEventsResolver,
        RecheckZaloConnectionResolver,
        SaveZnsRenewalResolver,
        SendZaloTestResolver,
    ],
})
/** The GraphQL transport of the zalo-connection-page feature. */
export class ZaloConnectionPageGraphqlModule extends ConfigurableModuleClass {}
