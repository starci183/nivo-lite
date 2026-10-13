import type { GenMessage, ResponseFormat } from "@modules/domain/ai-generations"
import type { Locale } from "@modules/platform/i18n"

/** What asking the agent engine for a text without waiting takes. */
export interface RequestGenerationRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** What the text is for; the usage page groups by it. */
    readonly purpose: string
    /** The prompt: system instructions, the dialogue and the input. */
    readonly messages: ReadonlyArray<GenMessage>
    /** Text or one JSON object. */
    readonly responseFormat: ResponseFormat
    /** How long the text may take, ms; the default when absent. */
    readonly timeoutMs?: number
    /** The usage kind the metering records the text under. */
    readonly kind: string
    /** The usage module the metering records the text under. */
    readonly module: string
    /** The language of the sentence a refusal carries. */
    readonly locale: Locale
}
