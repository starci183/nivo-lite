import type { DynamicModule } from "@nestjs/common"

/** The event reactors the api runs: each message module subscribes its consumers to their queues on the event bus. */
export const API_REACTORS: Array<DynamicModule> = [
]
