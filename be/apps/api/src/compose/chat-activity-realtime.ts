import type { DynamicModule } from "@nestjs/common"
import { ChatActivitySseModule } from "@features/realtime/chat-activity"

/** The chat activity push channel of the API: one server-sent-events door over the hub of the platform. */
export const chatActivityRealtimeModules = (): Array<DynamicModule> => [ChatActivitySseModule.register({})]
