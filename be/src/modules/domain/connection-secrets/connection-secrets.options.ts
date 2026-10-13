import type { Secret } from "@modules/platform/config"

/** Options of the connection-secrets capability. */
export interface ConnectionSecretsOptions {
    /** The AES-256 key that seals every connection credential: 32 bytes, base64. */
    readonly tokenKey: Secret
}
