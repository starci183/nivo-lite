import type { DynamicModule } from "@nestjs/common"
import { ChatActivitySseModule } from "@features/realtime/chat-activity"
import { ChatTypingSseModule } from "@features/realtime/chat-typing"

/** The realtime area of the API: the push channels, each a server-sent-events door over the hub of the platform. */
export const realtimeModules = (): Array<DynamicModule> => [
    ChatTypingSseModule.register({}),
    ChatActivitySseModule.register({}),
]
