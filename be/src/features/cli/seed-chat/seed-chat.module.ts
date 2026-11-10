import { Module } from "@nestjs/common"
import { SeedChatCli } from "./seed-chat.cli"
import { ConfigurableModuleClass } from "./seed-chat.module-definition"

@Module({ providers: [SeedChatCli] })
/** The seed-chat command over the chat seed of the channel-provisioning capability. */
export class SeedChatModule extends ConfigurableModuleClass {}
