import type { InjectionToken } from "@nestjs/common"

/** The prompt library's tunables, parsed once at boot. */
export interface DeepseekOptions {
    /** How many times a JSON prompt is asked again when the model answered in prose. */
    readonly jsonRetries: number
    /** How long one prompt may take on the AI pool, every key and fallback included, in milliseconds. */
    readonly poolTimeoutMs: number
}

/** What the prompt library needs at registration: its tunables and the providers of the doors it generates through. */
export interface DeepseekWiring extends DeepseekOptions {
    /** Provider of the `DeepseekTextGenerator` port (the OpenClaw generations capability). */
    readonly generator: InjectionToken
    /** Provider of the `DeepseekPool` port (the AI pool client). */
    readonly pool: InjectionToken
    /** Provider of the `DeepseekMeter` port (the usage gate). */
    readonly meter: InjectionToken
}
