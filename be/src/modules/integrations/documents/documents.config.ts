import { Secret } from "@modules/platform/config"
import type { EnvSource } from "@modules/platform/config"
import { libraryReaders } from "./library-readers.client"
import type { DocumentsGoogleClient, DocumentsOptions } from "./documents.options"

const DEFAULT_DRIVE_BASE = "https://www.googleapis.com/drive/v3"

const urlOf = (env: EnvSource, key: string): string | null => {
    const value = env.optional(key)
    return value !== undefined && URL.canParse(value) && /^https?:\/\//u.test(value) ? value.replace(/\/+$/u, "") : null
}

const googleOf = (env: EnvSource): DocumentsGoogleClient | null => {
    const clientId = env.optional("GOOGLE_OAUTH_CLIENT_ID") ?? env.optional("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID")
    const clientSecret =
        env.optional("GOOGLE_OAUTH_CLIENT_SECRET") ?? env.optional("SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET")
    return clientId !== undefined && clientSecret !== undefined
        ? { clientId, clientSecret: new Secret(clientSecret) }
        : null
}

/**
 * Reads the documents options. Nothing is required: a missing Google client only means that an expired Drive token
 * cannot be refreshed, and the base addresses default to Google's own.
 */
export const parseDocumentsConfig = (env: EnvSource): DocumentsOptions => ({
    driveBase: urlOf(env, "GOOGLE_DRIVE_BASE") ?? DEFAULT_DRIVE_BASE,
    oauthBase: urlOf(env, "GOOGLE_OAUTH_BASE"),
    google: googleOf(env),
    readers: libraryReaders,
})
