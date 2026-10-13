import { Module } from "@nestjs/common"
import { GoogleCallbackHandler } from "./application/google-callback.handler"

@Module({ providers: [GoogleCallbackHandler] })
/** The google-connections feature: the handler of its OAuth callback. */
export class GoogleConnectionsApiModule {}
