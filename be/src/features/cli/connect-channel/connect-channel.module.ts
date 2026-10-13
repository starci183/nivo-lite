import { Module } from "@nestjs/common"
import { ConnectChannelCli } from "./connect-channel.cli"

@Module({ providers: [ConnectChannelCli] })
/** The connect-channel command over the channel-provisioning capability. */
export class ConnectChannelModule {}
