import type { AgentConnections, AgentKnowledge } from "@nivo-lite/blocks-core/modules"

/** The connections region a person sees. */
export type ConnectionsRegion = Awaited<ReturnType<AgentConnections["of"]>>

/** The knowledge region a person sees. */
export type KnowledgeRegion = Awaited<ReturnType<AgentKnowledge["of"]>>

/** The tone of the badge of one connection state. */
export type StatusTone = ConnectionsRegion["rows"][number]["statusTone"]

/** The badge tone of a connection status; an unknown status is shown as neutral. */
export const toneOfStatus = (status: string): StatusTone => {
    if (status === "connected") return "success"
    if (status === "error") return "danger"
    if (status === "pending") return "warning"
    return "neutral"
}

/** The message key of a word of the regions, by the group it belongs to and the value (`connection_status.connected`). */
export const regionKey = (group: string, value: string): string => `workbench.platform.${group}.${value}`

/** The most gaps the knowledge card lists. */
export const GAPS_SHOWN = 5
