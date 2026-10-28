import { Module } from "@nestjs/common"
import { ConnectionsApiModule } from "../../connections.module"
import { AuthorizeGoogleResolver } from "./authorize-google.resolver"
import { AuthorizeMetaResolver } from "./authorize-meta.resolver"
import { AuthorizeZaloResolver } from "./authorize-zalo.resolver"
import { CheckConnectionResolver } from "./check-connection.resolver"
import { CheckMetaResolver } from "./check-meta.resolver"
import { ChooseMetaPageResolver } from "./choose-meta-page.resolver"
import { ConnectTelegramResolver } from "./connect-telegram.resolver"
import { ConfigurableModuleClass } from "./connections-graphql.module-definition"
import { DeleteConnectionResolver } from "./delete-connection.resolver"
import { DisconnectConnectionResolver } from "./disconnect-connection.resolver"
import { FinishWebhookConnectionResolver } from "./finish-webhook-connection.resolver"
import { GetConnectionFirstEventResolver } from "./get-connection-first-event.resolver"
import { GetGoogleStateResolver } from "./get-google-state.resolver"
import { GetMetaConnectionResolver } from "./get-meta-connection.resolver"
import { GetMoneyConnectionResolver } from "./get-money-connection.resolver"
import { GetSepayConnectionResolver } from "./get-sepay-connection.resolver"
import { GetZaloConnectionResolver } from "./get-zalo-connection.resolver"
import { ListConnectionAgentsResolver } from "./list-connection-agents.resolver"
import { ListConnectionsResolver } from "./list-connections.resolver"
import { ListSepayEventsResolver } from "./list-sepay-events.resolver"
import { ReturnZaloAuthorizationResolver } from "./return-zalo-authorization.resolver"
import { RevealSepayKeyResolver } from "./reveal-sepay-key.resolver"
import { RevealWebhookConnectionResolver } from "./reveal-webhook-connection.resolver"
import { SaveProviderKeysResolver } from "./save-provider-keys.resolver"
import { SaveZaloOaSecretResolver } from "./save-zalo-oa-secret.resolver"
import { SetAgentConnectionsResolver } from "./set-agent-connections.resolver"
import { SetConnectionAgentsResolver } from "./set-connection-agents.resolver"
import { SetConnectionGrantResolver } from "./set-connection-grant.resolver"
import { SetSepayEnvironmentResolver } from "./set-sepay-environment.resolver"
import { StartSmtpConnectionResolver } from "./start-smtp-connection.resolver"
import { SendSmtpTestResolver } from "./send-smtp-test.resolver"
import { ChangeSmtpPasswordResolver } from "./change-smtp-password.resolver"
import { SetDefaultSmtpResolver } from "./set-default-smtp.resolver"
import { StartMoneyConnectionResolver } from "./start-money-connection.resolver"
import { StartWebhookConnectionResolver } from "./start-webhook-connection.resolver"
import { StartZaloConnectionResolver } from "./start-zalo-connection.resolver"
import { TestWebhookConnectionResolver } from "./test-webhook-connection.resolver"
import { UpdateMoneyConnectionResolver } from "./update-money-connection.resolver"
import { UpdateWebhookEventsResolver } from "./update-webhook-events.resolver"
import { GetZaloPageResolver } from "./get-zalo-page.resolver"
import { ListZaloEventsResolver } from "./list-zalo-events.resolver"
import { RecheckZaloConnectionResolver } from "./recheck-zalo-connection.resolver"
import { SendZaloTestResolver } from "./send-zalo-test.resolver"
import { WantConnectorResolver } from "./want-connector.resolver"

@Module({
    imports: [ConnectionsApiModule.register({})],
    providers: [
        AuthorizeGoogleResolver,
        AuthorizeMetaResolver,
        AuthorizeZaloResolver,
        CheckConnectionResolver,
        CheckMetaResolver,
        ChooseMetaPageResolver,
        ConnectTelegramResolver,
        DeleteConnectionResolver,
        DisconnectConnectionResolver,
        FinishWebhookConnectionResolver,
        GetConnectionFirstEventResolver,
        GetGoogleStateResolver,
        GetMetaConnectionResolver,
        GetMoneyConnectionResolver,
        GetSepayConnectionResolver,
        GetZaloConnectionResolver,
        ListConnectionAgentsResolver,
        ListConnectionsResolver,
        ListSepayEventsResolver,
        ReturnZaloAuthorizationResolver,
        RevealSepayKeyResolver,
        RevealWebhookConnectionResolver,
        SaveProviderKeysResolver,
        SaveZaloOaSecretResolver,
        SetAgentConnectionsResolver,
        SetConnectionAgentsResolver,
        SetConnectionGrantResolver,
        SetSepayEnvironmentResolver,
        StartMoneyConnectionResolver,
        StartSmtpConnectionResolver,
        SendSmtpTestResolver,
        ChangeSmtpPasswordResolver,
        SetDefaultSmtpResolver,
        StartWebhookConnectionResolver,
        StartZaloConnectionResolver,
        TestWebhookConnectionResolver,
        UpdateMoneyConnectionResolver,
        UpdateWebhookEventsResolver,
        WantConnectorResolver,
        GetZaloPageResolver,
        ListZaloEventsResolver,
        RecheckZaloConnectionResolver,
        SendZaloTestResolver,
    ],
})
/** The GraphQL transport of the connections feature. */
export class ConnectionsGraphqlModule extends ConfigurableModuleClass {}
