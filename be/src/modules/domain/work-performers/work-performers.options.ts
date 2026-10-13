import type { InjectionToken } from "@nestjs/common"

/** What the work-performers capability needs from the app root. */
export interface WorkPerformersOptions {
    /** The provider token of the prompt writer (a `PromptWriter`); the prompt library of the deepseek integration. */
    readonly writer: InjectionToken
}
