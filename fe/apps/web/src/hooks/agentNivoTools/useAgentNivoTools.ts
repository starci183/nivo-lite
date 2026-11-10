"use client"

import { useTranslations } from "next-intl"
import { useMcpGrantCommands } from "@/hooks/mcpGrants"
import { useQueryMcpConnectorsSwr, useQueryMcpToolGrantsSwr } from "@/hooks/swr"
import { toolNameOf, toolTextOf } from "@/modules/mcpGateway"

/** One NIVO tool as the Quyền tab draws it for one agent. */
export interface AgentNivoToolRow {
    readonly tool: string
    readonly name: string
    readonly description: string
    /** The agent holds a grant on it that is not `never`. */
    readonly isOn: boolean
}

/** The NIVO tools (the tools of the native connectors) with the grant of one agent, and the switch. */
export interface AgentNivoTools {
    readonly rows: ReadonlyArray<AgentNivoToolRow>
    readonly isSaving: boolean
    readonly set: (tool: string, isOn: boolean) => void
}

/**
 * The tools of the native connectors with this agent's grant on each (`mcpToolGrants`), and the command that turns one on or off
 * (`setMcpToolGrant` through `useMcpGrantCommands`). Both are the same reads and writes the gateway region of Kết nối uses.
 */
export const useAgentNivoTools = (agentId: string | null): AgentNivoTools => {
    const t = useTranslations("mcpGateway")
    const connectors = useQueryMcpConnectorsSwr(true)
    const grants = useQueryMcpToolGrantsSwr(true)
    const commands = useMcpGrantCommands(grants.data ?? [], () => grants.mutate())
    const native = (connectors.data ?? []).filter((connector) => connector.kind === "native")
    const nativeKeys = new Set(native.map((connector) => connector.key))
    const held = new Map(
        (grants.data ?? []).filter((grant) => grant.agentId === agentId).map((grant) => [grant.tool, grant.mode]),
    )
    const rows = native.flatMap((connector) =>
        connector.tools.map((tool) => ({
            tool: tool.name,
            name: toolNameOf(t, tool.name, nativeKeys, tool.description),
            description: toolTextOf(t, "tool", tool.name, tool.description),
            isOn: held.has(tool.name) && held.get(tool.name) !== "never",
        })),
    )
    return {
        rows,
        isSaving: commands.busyKey !== null,
        set: (tool, isOn) => {
            if (agentId !== null) void commands.toggle(agentId, tool, isOn)
        },
    }
}
