import type { InjectionToken } from "@nestjs/common"

/** What the responsibilities capability needs from the app root. */
export interface ResponsibilitiesOptions {
    /** Provider that tells which agent speaks for a department (the agents capability). */
    readonly agentDirectory: InjectionToken
}
