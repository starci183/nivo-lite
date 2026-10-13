import type { InjectionToken } from "@nestjs/common"

/** What the meta-inbox capability needs from the app root. */
export interface MetaInboxOptions {
    /** The provider token of the Meta event taker (a `MetaEventTaker`): the lead generation flow's intake. */
    readonly taker: InjectionToken
}
