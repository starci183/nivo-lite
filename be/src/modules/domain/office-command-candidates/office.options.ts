import type { InjectionToken } from "@nestjs/common"

/** What the office capability needs from the composition root. */
export interface OfficeOptions {
    /** The provider token of the command reader (a `CommandReader`) in the app; the prompt library of the deepseek integration. */
    readonly reader: InjectionToken
}
