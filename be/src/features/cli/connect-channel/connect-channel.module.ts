import { Module } from "@nestjs/common"
import { ConnectChannelCli } from "./connect-channel.cli"
import { ConfigurableModuleClass } from "./connect-channel.module-definition"

@Module({ providers: [ConnectChannelCli] })
/** The connect-channel command over the channel-provisioning capability. */
export class ConnectChannelModule extends ConfigurableModuleClass {}
