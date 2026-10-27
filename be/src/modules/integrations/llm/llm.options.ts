import type { InjectionToken } from "@nestjs/common"

/** What the model port needs at registration: the provider of the AI pool it calls through. */
export interface LlmWiring {
    /** Provider of the `LlmPool` port (the AI pool client). */
    readonly pool: InjectionToken
}
