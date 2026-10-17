import { Module } from "@nestjs/common"
import { AuthorizeGoogleHandler } from "./application/authorize-google.handler"
import { AuthorizeMetaHandler } from "./application/authorize-meta.handler"
import { AuthorizeZaloHandler } from "./application/authorize-zalo.handler"
import { CheckConnectionHandler } from "./application/check-connection.handler"
import { CheckMetaHandler } from "./application/check-meta.handler"
import { ChooseMetaPageHandler } from "./application/choose-meta-page.handler"
import { ConnectTelegramHandler } from "./application/connect-telegram.handler"
import { DeleteConnectionHandler } from "./application/delete-connection.handler"
import { DisconnectConnectionHandler } from "./application/disconnect-connection.handler"
import { FinishWebhookConnectionHandler } from "./application/finish-webhook-connection.handler"
import { GetConnectionFirstEventHandler } from "./application/get-connection-first-event.handler"
import { GetGoogleStateHandler } from "./application/get-google-state.handler"
import { GetMetaConnectionHandler } from "./application/get-meta-connection.handler"
import { GetMoneyConnectionHandler } from "./application/get-money-connection.handler"
import { GetZaloConnectionHandler } from "./application/get-zalo-connection.handler"
import { ListConnectionAgentsHandler } from "./application/list-connection-agents.handler"
import { ListConnectionsHandler } from "./application/list-connections.handler"
import { ReturnZaloAuthorizationHandler } from "./application/return-zalo-authorization.handler"
import { RevealSepayKeyHandler } from "./application/reveal-sepay-key.handler"
import { RevealWebhookConnectionHandler } from "./application/reveal-webhook-connection.handler"
import { SaveProviderKeysHandler } from "./application/save-provider-keys.handler"
import { SaveZaloOaSecretHandler } from "./application/save-zalo-oa-secret.handler"
import { SetAgentConnectionsHandler } from "./application/set-agent-connections.handler"
import { SetConnectionAgentsHandler } from "./application/set-connection-agents.handler"
import { SetConnectionGrantHandler } from "./application/set-connection-grant.handler"
import { StartMoneyConnectionHandler } from "./application/start-money-connection.handler"
import { StartWebhookConnectionHandler } from "./application/start-webhook-connection.handler"
import { StartZaloConnectionHandler } from "./application/start-zalo-connection.handler"
import { TestWebhookConnectionHandler } from "./application/test-webhook-connection.handler"
import { UpdateMoneyConnectionHandler } from "./application/update-money-connection.handler"
import { UpdateWebhookEventsHandler } from "./application/update-webhook-events.handler"
import { StartSmtpConnectionHandler } from "./application/start-smtp-connection.handler"
import { SendSmtpTestHandler } from "./application/send-smtp-test.handler"
import { ChangeSmtpPasswordHandler } from "./application/change-smtp-password.handler"
import { SetDefaultSmtpHandler } from "./application/set-default-smtp.handler"
import { WantConnectorHandler } from "./application/want-connector.handler"
import { ConfigurableModuleClass } from "./connections.module-definition"

@Module({
    providers: [
        AuthorizeGoogleHandler,
        AuthorizeMetaHandler,
        AuthorizeZaloHandler,
        CheckConnectionHandler,
        CheckMetaHandler,
        ChooseMetaPageHandler,
        ConnectTelegramHandler,
        DeleteConnectionHandler,
        DisconnectConnectionHandler,
        FinishWebhookConnectionHandler,
        GetConnectionFirstEventHandler,
        GetGoogleStateHandler,
        GetMetaConnectionHandler,
        GetMoneyConnectionHandler,
        GetZaloConnectionHandler,
        ListConnectionAgentsHandler,
        ListConnectionsHandler,
        ReturnZaloAuthorizationHandler,
        RevealSepayKeyHandler,
        RevealWebhookConnectionHandler,
        SaveProviderKeysHandler,
        SaveZaloOaSecretHandler,
        SetAgentConnectionsHandler,
        SetConnectionAgentsHandler,
        SetConnectionGrantHandler,
        StartMoneyConnectionHandler,
        StartWebhookConnectionHandler,
        StartZaloConnectionHandler,
        TestWebhookConnectionHandler,
        UpdateMoneyConnectionHandler,
        UpdateWebhookEventsHandler,
        StartSmtpConnectionHandler,
        SendSmtpTestHandler,
        ChangeSmtpPasswordHandler,
        SetDefaultSmtpHandler,
        WantConnectorHandler,
    ],
})
/** The connections feature: the handlers of its application. */
export class ConnectionsApiModule extends ConfigurableModuleClass {}
