import type { EnvSource } from "@modules/platform/config"
import type { MetaPublishingOptions } from "./meta-publishing.options"

/** The Graph API origin (the reference pages' examples: `https://graph.facebook.com`). */
const GRAPH_ORIGIN = "https://graph.facebook.com"

/** The version the reference pages of the day show (`POST /v27.0/{page-id}/feed`); `META_GRAPH_VERSION` (the messaging client's setting) overrides it. */
const DEFAULT_VERSION = "v27.0"

/** A Graph version word (`v27.0`), or the default for anything else. */
const versionOf = (value: string | undefined): string => (value !== undefined && /^v\d{2,3}\.\d{1,2}$/u.test(value.trim()) ? value.trim() : DEFAULT_VERSION)

/** Reads the Meta publishing options: only tunables live in the environment. */
export const parseMetaPublishingConfig = (env: EnvSource): MetaPublishingOptions => ({
    graphBase: `${GRAPH_ORIGIN}/${versionOf(env.optional("META_GRAPH_VERSION"))}`,
    timeoutMs: env.duration("META_PUBLISHING_TIMEOUT", 30_000),
})
