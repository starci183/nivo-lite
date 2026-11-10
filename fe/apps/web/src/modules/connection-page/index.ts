import type { ConnectionPageTabId } from "@/modules/types"

/** The query parameter that names the open tab of a connection page. */
export const CONNECTION_PAGE_VIEW_PARAM = "view"

/** The tabs of every connection page, in order. */
export const CONNECTION_PAGE_TABS: ReadonlyArray<ConnectionPageTabId> = ["overview", "events", "agents", "settings"]

/** The tab an address asks for; the overview when it names none or an unknown one. */
export const connectionPageTabOf = (value: string | string[] | null | undefined): ConnectionPageTabId =>
    CONNECTION_PAGE_TABS.find((id) => id === value) ?? "overview"
