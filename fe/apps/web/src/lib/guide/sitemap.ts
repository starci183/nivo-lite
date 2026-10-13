/**
 * The NIVO guide's map of the console: every place the assistant may send someone. The words (name, purpose, steps, search phrases)
 * live in the `guideMap` catalog by page id. The guide only ever links to an entry of this map (never a URL a model made up), and
 * `managerOnly` entries are never offered to staff. `target` names the element marked `data-guide="<target>"` that is highlighted
 * after the jump.
 */

/** One place of the console the guide may send someone to. */
export interface GuidePage {
    readonly id: string
    readonly path: string
    readonly managerOnly?: boolean
    readonly target?: string
}

/** The pages of the map. */
export const GUIDE_PAGES: ReadonlyArray<GuidePage> = [
    { id: "office", path: "/chat" },
    { id: "overview", path: "/dashboard" },
    { id: "authority", path: "/authority" },
    { id: "inbox", path: "/inbox" },
    { id: "leads", path: "/leads" },
    { id: "responsibilities", path: "/responsibilities" },
    { id: "decisions", path: "/decisions" },
    { id: "automations", path: "/automations", managerOnly: true },
    { id: "knowledge", path: "/knowledge", managerOnly: true },
    { id: "brain", path: "/brain" },
    { id: "modules", path: "/agents", managerOnly: true },
    { id: "team", path: "/team", managerOnly: true, target: "team.invite" },
    { id: "connections", path: "/connections", managerOnly: true },
    { id: "connections.sepay", path: "/connections", managerOnly: true, target: "connections.sepay" },
    { id: "connections.telegram", path: "/connections", managerOnly: true, target: "connections.telegram" },
    { id: "connections.zalo_oa", path: "/connections", managerOnly: true, target: "connections.zalo_oa" },
    { id: "connections.smtp", path: "/connections", managerOnly: true, target: "connections.smtp" },
    { id: "connections.google", path: "/connections", managerOnly: true, target: "connections.google" },
    { id: "connections.webhook", path: "/connections", managerOnly: true, target: "connections.webhook" },
    { id: "developers", path: "/developers", managerOnly: true },
    { id: "billing", path: "/billing", managerOnly: true },
    { id: "account", path: "/account" },
]

/** The pages a member with this role may be sent to. */
export const pagesFor = (isManager: boolean): ReadonlyArray<GuidePage> =>
    GUIDE_PAGES.filter((page) => isManager || page.managerOnly !== true)

/** The map entry whose path is the start of `pathname` (longest wins), for "you are here". */
export const pageAt = (pathname: string): GuidePage | undefined =>
    GUIDE_PAGES.filter((page) => page.target === undefined || page.id === "team")
        .sort((a, b) => b.path.length - a.path.length)
        .find((page) => pathname === page.path || pathname.startsWith(`${page.path}/`))
