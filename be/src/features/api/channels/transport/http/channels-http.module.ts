import { Module } from "@nestjs/common"
import { ChannelsApiModule } from "../../channels.module"
import { ChannelsController } from "./channels.controller"

@Module({ imports: [ChannelsApiModule], controllers: [ChannelsController] })
/** The HTTP transport of the channels feature. */
export class ChannelsHttpModule {}
