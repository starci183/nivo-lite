import type { Secret } from "@modules/platform/config"

/** The OpenAI-compatible endpoint LangChain calls: the AI router gateway that runs in the API process, or a provider directly. */
export interface AiOptions {
    /** The base URL the OpenAI paths hang from (the in-process gateway, `http://localhost:3212/v1`), without a trailing slash; null when none is known. */
    readonly gatewayUrl: string | null
    /** The virtual key of the gateway, or a provider key; null when the deployment has none, and AI is then unavailable. */
    readonly virtualKey: Secret | null
    /** The profile (gateway) or model (provider) chat calls ask for. */
    readonly chatModel: string
    /** The profile or model embeddings calls ask for. */
    readonly embeddingModel: string
}

/** An endpoint that can be called: the base URL and the key are both known. */
export interface AiEndpoint {
    /** The base URL the OpenAI paths hang from. */
    readonly gatewayUrl: string
    /** The virtual key of the gateway, or a provider key. */
    readonly virtualKey: Secret
    /** The profile (gateway) or model (provider) chat calls ask for. */
    readonly chatModel: string
    /** The profile or model embeddings calls ask for. */
    readonly embeddingModel: string
}
