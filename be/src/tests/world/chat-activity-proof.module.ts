import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChatActivityModule } from "@modules/domain/chat-activity"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { appPgTypes } from "@modules/integrations/data-sources"
import { DatabaseModule } from "@modules/platform/database"
import { IdsModule } from "@modules/platform/ids"

@Module({ providers: [WorkspaceMemberSeatsService], exports: [WorkspaceMemberSeatsService] })
class ChatActivitySeatsModule {}

/** The real chat activity push and the capabilities it stands on; the hub comes from the world that opens one. */
export const CHAT_ACTIVITY_PROOF_MODULES: ReadonlyArray<DynamicModule> = [
    DatabaseModule.register({ isGlobal: true, connections: [], entities: [], typeParsers: appPgTypes }),
    IdsModule.register({ isGlobal: true }),
    { module: ChatActivitySeatsModule, global: true },
    ChatActivityModule.register({ isGlobal: true }),
]
