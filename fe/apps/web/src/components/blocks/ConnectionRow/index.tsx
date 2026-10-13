"use client"

import { useConnectionRowView } from "@/hooks/connections"
import type { AgentOption, Connection } from "@/modules/types"
import { ConnectionRowBase } from "./component"

/** What the page that read the connection hands its row. */
type ConnectionRowProps = {
    readonly connection: Connection
    /** The names of the agents bound to the connection. */
    readonly agentNames: ReadonlyArray<string>
    /** The site is not public https: Telegram cannot reach the webhook from here. */
    readonly localOnly: boolean
    /** The signed-in person's email: the default recipient of the SMTP test message. */
    readonly ownerEmail?: string
    /** The workspace agents, for the access picker. */
    readonly agents?: ReadonlyArray<AgentOption>
    /** The workspace owner may change the connection and who uses it; everyone else sees the row read-only (checks still run). */
    readonly canManage?: boolean
}

/** One connection as a list row with its commands: check, edit, reveal keys, disconnect, remove, and who may use it. */
export const ConnectionRow = (props: ConnectionRowProps) => {
    const { connection } = props
    const { view, on } = useConnectionRowView({
        connection,
        agentNames: props.agentNames,
        localOnly: props.localOnly,
        ownerEmail: props.ownerEmail ?? "",
        agents: props.agents ?? [],
        canManage: props.canManage ?? false,
    })
    return <ConnectionRowBase props={view} on={on} />
}
