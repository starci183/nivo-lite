"use client"

import { useMutateSetMcpToolGrantSwr } from "@/hooks/swr"
import type { useQueryMcpToolGrantsSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { grantKeyOf } from "./mcpGrants.shared"

/** One agent's grant of a gateway tool, as the `mcpToolGrants` read answers it. */
type McpGrantType = NonNullable<ReturnType<typeof useQueryMcpToolGrantsSwr>["data"]>[number]

/** The mode a switch writes: off is `never`; on keeps the mode the agent had unless it had none or `never`, which start at `auto`. */
const modeOf = (isOn: boolean, held: string | undefined): string => {
    if (!isOn) return "never"
    return held === undefined || held === "never" ? "auto" : held
}

/** The switches of the gateway tools (owner | manager), and which one is saving. */
export interface McpGrantCommands {
    /** Turns one tool on (`auto`, or the mode the agent already had) or off (`never`) for one agent, then reloads the grants. */
    readonly toggle: (agentId: string, tool: string, isOn: boolean) => Promise<void>
    /** The `agentId:tool` a save is running for, or null. */
    readonly busyKey: string | null
}

/**
 * The grant switch of a gateway tool, calling `setMcpToolGrant`. Nothing is granted by itself (default deny): a switch turned on writes
 * `auto`, a switch turned off writes `never`, and the data constraints and the money limit an existing grant carries are kept.
 */
export const useMcpGrantCommands = (
    grants: ReadonlyArray<McpGrantType>,
    reload: () => Promise<unknown>,
): McpGrantCommands => {
    const t = useTranslations("mcpGateway")
    const runGraphQL = useGraphQLWithToast()
    const { trigger } = useMutateSetMcpToolGrantSwr()
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const toggle = useCallback(
        async (agentId: string, tool: string, isOn: boolean) => {
            const held = grants.find((grant) => grant.agentId === agentId && grant.tool === tool)
            const mode = modeOf(isOn, held?.mode)
            setBusyKey(grantKeyOf(agentId, tool))
            const saved = await runGraphQL(
                () =>
                    trigger({
                        agentId,
                        tool,
                        mode,
                        ...(held === undefined ? {} : { constraintsJson: held.constraintsJson }),
                        ...(held?.limitVnd === null || held?.limitVnd === undefined ? {} : { limitVnd: held.limitVnd }),
                    }),
                { successMessage: t("grantSaved") },
            )
            setBusyKey(null)
            if (saved !== undefined) await reload()
        },
        [grants, runGraphQL, trigger, reload, t],
    )
    return { toggle, busyKey }
}
