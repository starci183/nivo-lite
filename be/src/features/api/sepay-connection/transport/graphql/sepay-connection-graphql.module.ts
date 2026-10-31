import { Module } from "@nestjs/common"
import { SepayConnectionApiModule } from "../../sepay-connection.module"
import { ConfigurableModuleClass } from "./sepay-connection-graphql.module-definition"
import { GetSepayConnectionResolver } from "./get-sepay-connection.resolver"
import { ListSepayEventsResolver } from "./list-sepay-events.resolver"
import { RevealSepayKeyResolver } from "./reveal-sepay-key.resolver"
import { RotateSepayKeyResolver } from "./rotate-sepay-key.resolver"
import { SetSepayEnvironmentResolver } from "./set-sepay-environment.resolver"

@Module({
    imports: [SepayConnectionApiModule.register({})],
    providers: [
        GetSepayConnectionResolver,
        ListSepayEventsResolver,
        RevealSepayKeyResolver,
        RotateSepayKeyResolver,
        SetSepayEnvironmentResolver,
    ],
})
/** The GraphQL transport of the sepay-connection feature. */
export class SepayConnectionGraphqlModule extends ConfigurableModuleClass {}
