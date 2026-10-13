import type { InjectionToken } from "@nestjs/common"

/** What the messages capability needs from the app root. */
export interface MessagesOptions {
    /** Provider that tells which agent speaks for a department (the agents capability). */
    readonly agentDirectory: InjectionToken
}
