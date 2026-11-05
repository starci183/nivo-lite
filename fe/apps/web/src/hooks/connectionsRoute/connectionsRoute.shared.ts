import type { Connection, PaneGridLayout } from "@/modules/types"

/** What decides the arrangement of the Connections pane grid. */
interface ConnectionsGridInput {
    /** The list pane stands beside the routed page; a workspace with no connection has the page alone. */
    readonly hasList: boolean
    /** The address is the Connections root: a phone shows the list there, the open connection's page elsewhere. */
    readonly isRoot: boolean
}

/**
 * The areas and tracks of the Connections pane grid: the list beside the routed page from 48rem, at the wide rail width. A phone shows
 * one pane, the list at the root and the page of the open connection elsewhere.
 */
export const connectionsGridOf = (input: ConnectionsGridInput): PaneGridLayout => ({
    areas: {
        base: input.hasList && input.isRoot ? ["list"] : ["content"],
        medium: input.hasList ? ["list content"] : ["content"],
        wide: input.hasList ? ["list content"] : ["content"],
    },
    columns: {
        base: ["fill"],
        medium: input.hasList ? ["wide", "fill"] : ["fill"],
        wide: input.hasList ? ["wide", "fill"] : ["fill"],
    },
    rows: { base: ["fill"], medium: ["fill"], wide: ["fill"] },
})

/** The pages of a connection that carry its id in the address: `/connections/<segment>/<id>`. */
const SEGMENTS: ReadonlySet<string> = new Set(["zalo", "telegram", "sepay"])

/** The single Google Drive page, whose address carries no id. */
const DRIVE = "drive"

/**
 * The connection the path opens: the one a provider page names by its id, the workspace's Google Drive grant for the Drive page, or
 * null on the Connections root and on a path that names none the workspace owns.
 */
export const connectionIdOfPath = (
    pathname: string,
    items: ReadonlyArray<Pick<Connection, "id" | "provider">>,
): string | null => {
    const [, root, segment, id] = pathname.split("/")
    if (root !== "connections" || segment === undefined) return null
    if (segment === DRIVE) return items.find((item) => item.provider === "google_drive")?.id ?? null
    if (!SEGMENTS.has(segment) || id === undefined) return null
    return items.some((item) => item.id === id) ? id : null
}
