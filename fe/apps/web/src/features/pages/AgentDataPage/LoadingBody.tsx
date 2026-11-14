"use client"

import type { ReactElement } from "react"
import { useParams } from "next/navigation"
import { AgentDataBody } from "@/components/blocks/AgentDataBody"
import { useAgentRoute } from "@/hooks/installations"

/** What the address of a data page names. */
type DataParams = { set?: string }

/**
 * The data page while it loads. A loading boundary receives no params, so the type, the instance and the set come from the address; the
 * view then draws what its spec declares (its title and column heads) with skeleton rows while its reads run.
 */
export const AgentDataLoadingBody = (): ReactElement => {
    const route = useAgentRoute()
    const params = useParams<DataParams>()
    return (
        <AgentDataBody
            workspaceId={route.workspaceId}
            module={route.module}
            installationId={route.installationId}
            set={params.set ?? ""}
        />
    )
}
