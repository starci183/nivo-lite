import type { GenMessage, ResponseFormat } from "@modules/domain/ai-generations"
/** What generate text takes. */
export interface GenerateTextRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** What the text is for; the usage page groups by it. */
    readonly purpose: string
    /** The prompt: system instructions, the dialogue and the input. */
    readonly messages: ReadonlyArray<GenMessage>
    /** Text or one JSON object. */
    readonly responseFormat: ResponseFormat
    /** How long the caller waits, ms; the default when absent. */
    readonly timeoutMs: number | undefined
    /** The usage kind the metering records the text under. */
    readonly kind: string
    /** The usage module the metering records the text under. */
    readonly module: string
}
