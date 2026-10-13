import { Module } from "@nestjs/common"
import { GoogleConnectionsApiModule } from "../../google-connections.module"
import { GoogleCallbackController } from "./google-callback.controller"
import { GoogleConnectionsController } from "./google-connections.controller"

@Module({ imports: [GoogleConnectionsApiModule], controllers: [GoogleConnectionsController, GoogleCallbackController] })
/** The HTTP transport of the google-connections feature. */
export class GoogleConnectionsHttpModule {}
