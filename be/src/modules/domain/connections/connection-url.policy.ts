import type { Provider } from "./connections.contracts"

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"])
const DEFAULT_ORIGIN = "http://localhost:3100"

/** The public https origin providers can reach, or null on localhost, plain http or when unset. */
export const publicSiteUrl = (siteUrl: string | undefined): string | null => {
    if (siteUrl === undefined || !URL.canParse(siteUrl)) return null
    const url = new URL(siteUrl)
    const local = LOCAL_HOSTS.has(url.hostname) || url.hostname.endsWith(".localhost")
    return url.protocol === "https:" && !local ? url.origin : null
}

/** True when providers cannot reach this site (a webhook cannot be registered there). */
export const isLocalOnly = (siteUrl: string | undefined): boolean => publicSiteUrl(siteUrl) === null

/** The webhook URL a provider must call for a connection, built from the site url even on localhost for display. */
export const webhookUrlFor = (provider: Provider, connectionId: string, siteUrl: string | undefined): string => {
    const base = (siteUrl ?? DEFAULT_ORIGIN).replace(/\/$/, "")
    // Meta has ONE webhook for the whole app (the Page id inside each event finds the connection).
    if (provider === "meta") return `${base}/api/connections/meta/webhook`
    if (provider === "telegram") return `${base}/api/telegram/${connectionId}`
    return `${base}/api/connections/${provider === "zalo_oa" ? "zalo" : provider}/${connectionId}`
}
