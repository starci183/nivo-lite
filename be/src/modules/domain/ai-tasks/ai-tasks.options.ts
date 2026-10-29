import type { InjectionToken } from "@nestjs/common"
import type { AiOptions } from "@modules/integrations/ai"

/** The prompt library tunables, parsed once at boot. */
export interface AiTasksOptions {
    /** How many times a JSON prompt is asked again when the model answered in prose. */
    readonly jsonRetries: number
    /** How long one prompt may take on the AI endpoint, in milliseconds. */
    readonly timeoutMs: number
    /** The AI endpoint the app root registers the LangChain client with: the gateway of this deployment, or a provider. */
    readonly endpoint: AiOptions
}

/** What the prompt library needs at registration: its tunables and the providers of the doors it generates through. */
export interface AiTasksWiring extends AiTasksOptions {
    /** Provider of the `AiTaskTextGenerator` port (the OpenClaw generations capability). */
    readonly generator: InjectionToken
    /** Provider of the `AiTaskRecall` port (the agent knowledge lens). */
    readonly recall: InjectionToken
    /** Provider of the `AiTaskMeter` port (the usage gate). */
    readonly meter: InjectionToken
}
