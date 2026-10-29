import type { DynamicModule } from "@nestjs/common"
import { AgentSyncMessageModule } from "@features/reactors/agent-sync"
import { ThreadOutcomesMessageModule } from "@features/reactors/thread-outcomes"

/** The event reactors the api runs: each message module subscribes its consumers to their queues on the event bus. */
export const API_REACTORS: Array<DynamicModule> = [
    AgentSyncMessageModule.register({}),
    ThreadOutcomesMessageModule.register({}),
]
