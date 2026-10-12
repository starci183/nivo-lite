import { Module } from "@nestjs/common"
import { ChannelConnectionsApiModule } from "../../channel-connections.module"
import { ChannelConnectionsController } from "./channel-connections.controller"

@Module({ imports: [ChannelConnectionsApiModule], controllers: [ChannelConnectionsController] })
/** The HTTP transport of the channel-connections feature. */
export class ChannelConnectionsHttpModule {}
