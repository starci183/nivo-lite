import { META_SCOPES } from "./meta.contracts"
import type { MetaOptions } from "./meta.options"

/** The oldest Graph API major version this client speaks. */
export const MIN_GRAPH_VERSION = 21

/** The Graph API version used when none (or a malformed or older one) is configured. */
export const DEFAULT_GRAPH_VERSION = "v21.0"

type Params = Readonly<Record<string, string | number | boolean | undefined>>

const trimSlashes = (value: string): string => value.replace(/\/+$/u, "")

/** The configured Graph version ("v21.0" or later); anything older or malformed falls back to v21.0. */
export const graphVersion = (options: Pick<MetaOptions, "graphVersion">): string => {
    const matched = /^v(\d{2,3})\.(\d{1,2})$/u.exec((options.graphVersion ?? "").trim())
    return matched && Number(matched[1]) >= MIN_GRAPH_VERSION ? `v${matched[1]}.${matched[2]}` : DEFAULT_GRAPH_VERSION
}

/** A Graph API url with its query. */
export const graphUrl = (options: Pick<MetaOptions, "graphVersion">, path: string, params: Params = {}): string => {
    const url = new URL(`https://graph.facebook.com/${graphVersion(options)}/${path.replace(/^\/+/u, "")}`)
    for (const [name, value] of Object.entries(params))
        if (value !== undefined) url.searchParams.set(name, String(value))
    return url.toString()
}

/** The Facebook login dialog url. */
export const dialogUrl = (
    options: Pick<MetaOptions, "graphVersion">,
    params: Readonly<Record<string, string | undefined>>,
): string => {
    const url = new URL(`https://www.facebook.com/${graphVersion(options)}/dialog/oauth`)
    for (const [name, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(name, value)
    return url.toString()
}

/** The OAuth redirect uri to register on the Meta app, or null without a site url. */
export const redirectUri = (options: Pick<MetaOptions, "siteUrl">): string | null =>
    options.siteUrl ? `${trimSlashes(options.siteUrl)}/api/connections/meta/callback` : null

/** The one webhook url of the Meta app, or null without a site url. */
export const webhookUrl = (options: Pick<MetaOptions, "siteUrl">): string | null =>
    options.siteUrl ? `${trimSlashes(options.siteUrl)}/api/connections/meta/webhook` : null

/** True when the site url is a public https origin Meta can call back (not localhost, not plain http). */
export const isPublicSite = (options: Pick<MetaOptions, "siteUrl">): boolean => {
    const site = options.siteUrl
    if (site === undefined || !URL.canParse(site)) return false
    const url = new URL(site)
    const local =
        url.hostname === "localhost" ||
        url.hostname.endsWith(".localhost") ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]"
    return url.protocol === "https:" && !local
}

/**
 * The Meta login url. With a login configuration id (a Facebook Login for Business configuration holding the permissions) the
 * dialog uses `config_id`; without it the classic `scope` list is sent. Null when the app or the site url is missing.
 */
export const authorizeUrl = (
    options: Pick<MetaOptions, "app" | "siteUrl" | "graphVersion" | "loginConfigId">,
    state: string,
): string | null => {
    const redirect = redirectUri(options)
    if (!options.app || redirect === null) return null
    const configId = (options.loginConfigId ?? "").trim()
    return dialogUrl(options, {
        client_id: options.app.appId,
        redirect_uri: redirect,
        state,
        response_type: "code",
        ...(configId
            ? { config_id: configId, override_default_response_type: "true" }
            : { scope: META_SCOPES.join(",") }),
    })
}
