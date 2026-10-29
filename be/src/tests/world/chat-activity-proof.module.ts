import type { DynamicModule } from "@nestjs/common"
import { ChatActivityModule } from "@modules/domain/chat-activity"
import { appPgTypes } from "@modules/integrations/data-sources"
import { DatabaseModule } from "@modules/platform/database"
import { IdsModule } from "@modules/platform/ids"

/** The real chat activity push and the capabilities it stands on; the hub comes from the world that opens one. */
export const CHAT_ACTIVITY_PROOF_MODULES: ReadonlyArray<DynamicModule> = [
    DatabaseModule.register({ isGlobal: true, connections: [], entities: [], typeParsers: appPgTypes }),
    IdsModule.register({ isGlobal: true }),
    ChatActivityModule.register({ isGlobal: true }),
]
