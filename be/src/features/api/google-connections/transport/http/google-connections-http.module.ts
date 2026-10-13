import { Module } from "@nestjs/common"
import { GoogleConnectionsApiModule } from "../../google-connections.module"
import { GoogleCallbackController } from "./google-callback.controller"

@Module({ imports: [GoogleConnectionsApiModule], controllers: [GoogleCallbackController] })
/** The HTTP transport of the google-connections feature: the callback Google redirects the browser to. */
export class GoogleConnectionsHttpModule {}
