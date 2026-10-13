import type { InjectionToken } from "@nestjs/common"

/** The prompt library's tunables, parsed once at boot. */
export interface DeepseekOptions {
    /** How many times a JSON prompt is asked again when the model answered in prose. */
    readonly jsonRetries: number
}

/** What the prompt library needs at registration: its tunables and the provider of the text door it generates through. */
export interface DeepseekWiring extends DeepseekOptions {
    /** Provider of the `DeepseekTextGenerator` port (the generations capability). */
    readonly generator: InjectionToken
}
