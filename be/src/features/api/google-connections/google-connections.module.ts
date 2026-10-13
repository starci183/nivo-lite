import { Module } from "@nestjs/common"
import { GoogleCallbackHandler } from "./application/google-callback.handler"
import { GoogleAuthorizeHandler } from "./application/google-authorize.handler"
import { GoogleAccountsHandler } from "./application/google-accounts.handler"
import { GoogleStateHandler } from "./application/google-state.handler"

@Module({
    providers: [GoogleCallbackHandler, GoogleAuthorizeHandler, GoogleAccountsHandler, GoogleStateHandler],
})
/** The google-connections feature: the handlers of its application. */
export class GoogleConnectionsApiModule {}
