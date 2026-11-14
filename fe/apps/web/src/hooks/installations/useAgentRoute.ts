"use client"

import { useParams } from "next/navigation"
import { MODULE_REGISTRY, answersCustomersOf, hasReplyLimitsOf, isModuleKey, type ModuleKey } from "@/modules/catalog"
import type { ModuleIconName } from "@/modules/types"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What a block of an agent page was handed by its route; a loading boundary hands nothing (it knows no params). */
interface AgentRouteGiven {
    readonly workspaceId?: string | undefined
    readonly module?: string | undefined
    readonly installationId?: string | undefined
    readonly runId?: string | undefined
    readonly workflowKey?: string | undefined
}

/** The segments of an agent page address. */
type AgentRouteParams = {
    readonly module?: string
    readonly installation?: string
    readonly runId?: string
    readonly workflowKey?: string
    readonly version?: string
}

/** The agent type, instance, run, workflow and version a block draws. */
interface AgentRoute {
    readonly workspaceId: string
    readonly module: ModuleKey
    readonly installationId: string
    readonly runId: string
    readonly workflowKey: string
    /** The version number of `/versions/<n>`, or 0 when the address names none. */
    readonly version: number
    /** The mark of the type, as the catalogue declares it. */
    readonly glyph: ModuleIconName
    /** Whether an agent of the type answers customers (every type but the internal ones). */
    readonly answersCustomers: boolean
    /** Whether the general settings of the type carry the reply limits of the chatbot. */
    readonly hasReplyLimits: boolean
}

/**
 * The agent page that is open. A route page hands its block the segments it awaited; the route's `loading.tsx` receives no params, so
 * the same block drawn there in its loading state reads them from the address (`/agents/<module>/<installation>/...`). The frame layout
 * already refused an unknown type, so the fallback type only stands for an address that never renders.
 */
export const useAgentRoute = (given: AgentRouteGiven = {}): AgentRoute => {
    const params = useParams<AgentRouteParams>()
    const workspaceId = useWorkspaceId()
    const named = given.module ?? params.module
    const module: ModuleKey = isModuleKey(named) ? named : "chatbot"
    const version = Number(params.version ?? "0")
    return {
        workspaceId: given.workspaceId ?? workspaceId,
        module,
        glyph: MODULE_REGISTRY[module].glyph,
        answersCustomers: answersCustomersOf(module),
        hasReplyLimits: hasReplyLimitsOf(module),
        installationId: given.installationId ?? params.installation ?? "",
        runId: given.runId ?? params.runId ?? "",
        workflowKey: given.workflowKey ?? params.workflowKey ?? "",
        version: Number.isInteger(version) ? version : 0,
    }
}
