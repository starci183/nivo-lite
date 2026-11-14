import type { ProviderPageTab } from "@/modules/types"

/** The tabs of the one provider page template a connected account opens on, in order; `config` is the first and opens by default. */
export const PROVIDER_PAGE_TABS: ReadonlyArray<ProviderPageTab> = ["config", "rights", "api", "mcp", "trigger"]

/** The address of one connected account's page under the console (`/connections/open/<id>`), without the workspace prefix. */
export const providerPagePath = (connectionId: string): string => `/connections/open/${encodeURIComponent(connectionId)}`

/** The address of one tab of a connected account's page: `config` is the page itself, every other tab one segment below it. */
export const providerPageTabPath = (connectionId: string, tab: ProviderPageTab): string =>
    tab === "config" ? providerPagePath(connectionId) : `${providerPagePath(connectionId)}/${tab}`

/** The tab an address names by its last segment; `config` when the address is the page itself or names no tab. */
export const providerPageTabOfPath = (pathname: string): ProviderPageTab => {
    const last = pathname.split("/").findLast(Boolean)
    return PROVIDER_PAGE_TABS.find((id) => id !== "config" && id === last) ?? "config"
}
