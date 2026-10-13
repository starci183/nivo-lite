import { Module } from "@nestjs/common"
import { ConnectionsApiModule } from "../../connections.module"
import { AuthorizeGoogleResolver } from "./authorize-google.resolver"
import { AuthorizeMetaResolver } from "./authorize-meta.resolver"
import { AuthorizeZaloResolver } from "./authorize-zalo.resolver"
import { CheckConnectionResolver } from "./check-connection.resolver"
import { CheckMetaResolver } from "./check-meta.resolver"
import { ChooseMetaPageResolver } from "./choose-meta-page.resolver"
import { ConnectTelegramResolver } from "./connect-telegram.resolver"
import { DeleteConnectionResolver } from "./delete-connection.resolver"
import { DisconnectConnectionResolver } from "./disconnect-connection.resolver"
import { FinishWebhookConnectionResolver } from "./finish-webhook-connection.resolver"
import { GetConnectionFirstEventResolver } from "./get-connection-first-event.resolver"
import { GetGoogleStateResolver } from "./get-google-state.resolver"
import { GetMetaConnectionResolver } from "./get-meta-connection.resolver"
import { GetMoneyConnectionResolver } from "./get-money-connection.resolver"
import { GetZaloConnectionResolver } from "./get-zalo-connection.resolver"
import { ListConnectionAgentsResolver } from "./list-connection-agents.resolver"
import { ListConnectionsResolver } from "./list-connections.resolver"
import { ReturnZaloAuthorizationResolver } from "./return-zalo-authorization.resolver"
import { RevealSepayKeyResolver } from "./reveal-sepay-key.resolver"
import { RevealWebhookConnectionResolver } from "./reveal-webhook-connection.resolver"
import { SaveProviderKeysResolver } from "./save-provider-keys.resolver"
import { SaveZaloOaSecretResolver } from "./save-zalo-oa-secret.resolver"
import { SetAgentConnectionsResolver } from "./set-agent-connections.resolver"
import { SetConnectionAgentsResolver } from "./set-connection-agents.resolver"
import { SetConnectionGrantResolver } from "./set-connection-grant.resolver"
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
import { WantConnectorResolver } from "./want-connector.resolver"

@Module({
    imports: [ConnectionsApiModule],
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
        GetZaloConnectionResolver,
        ListConnectionAgentsResolver,
        ListConnectionsResolver,
        ReturnZaloAuthorizationResolver,
        RevealSepayKeyResolver,
        RevealWebhookConnectionResolver,
        SaveProviderKeysResolver,
        SaveZaloOaSecretResolver,
        SetAgentConnectionsResolver,
        SetConnectionAgentsResolver,
        SetConnectionGrantResolver,
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
    ],
})
/** The GraphQL transport of the connections feature. */
export class ConnectionsGraphqlModule {}
