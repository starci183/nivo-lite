import type { InjectionToken } from "@nestjs/common"

/** What the usage capability needs from the composition root. */
export interface AiUsageEventsOptions {
    /** The provider of the owner notice (a `UsageNoticeDoor`): the team chat notices in the api; absent where no chat is composed. */
    readonly notices?: InjectionToken
}
