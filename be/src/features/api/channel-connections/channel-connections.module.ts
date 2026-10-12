import { Module } from "@nestjs/common"
import { ConnectTelegramHandler } from "./application/connect-telegram.handler"
import { StartMoneyHandler } from "./application/start-money.handler"
import { UpdateMoneyHandler } from "./application/update-money.handler"
import { ResumeConnectionHandler } from "./application/resume-connection.handler"
import { RevealSepayKeyHandler } from "./application/reveal-sepay-key.handler"
import { SaveProviderKeysHandler } from "./application/save-provider-keys.handler"
import { StartZaloHandler } from "./application/start-zalo.handler"
import { ResumeZaloHandler } from "./application/resume-zalo.handler"
import { SaveZaloOaSecretHandler } from "./application/save-zalo-oa-secret.handler"
import { ZaloAuthorizeHandler } from "./application/zalo-authorize.handler"
import { CheckConnectionHandler } from "./application/check-connection.handler"

@Module({
    providers: [
        ConnectTelegramHandler,
        StartMoneyHandler,
        UpdateMoneyHandler,
        ResumeConnectionHandler,
        RevealSepayKeyHandler,
        SaveProviderKeysHandler,
        StartZaloHandler,
        ResumeZaloHandler,
        SaveZaloOaSecretHandler,
        ZaloAuthorizeHandler,
        CheckConnectionHandler,
    ],
})
/** The channel-connections feature: the handlers of its application. */
export class ChannelConnectionsApiModule {}
