import type { InjectionToken } from "@nestjs/common"

/** Composition options of the team chat capability. */
export interface TeamChatOptions {
    /** Makes its service available to application features and jobs. */
    readonly isGlobal?: boolean
    /** Provider token of the private object storage door the files of the chat sit in; an app without one refuses files as data. */
    readonly storage?: InjectionToken
}
