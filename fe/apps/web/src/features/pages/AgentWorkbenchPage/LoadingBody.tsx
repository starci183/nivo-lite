"use client"

import type { ReactElement } from "react"
import { useSearchParams } from "next/navigation"
import { SpecWorkbenchFrame } from "@/components/blocks/SpecWorkbenchFrame"
import { useAgentRoute } from "@/hooks/installations"
import { agentHref } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"
import { workbenchSpec } from "@/modules/workbench-spec"
import { AgentWorkbenchPageBase } from "./component"

/** The words of every workbench layout, translated on the server: the browser picks the layout of the agent type in the address. */
export interface WorkbenchLoadingWords {
    readonly pending: { readonly title: string; readonly body: string; readonly setupLabel: string }
}

/** What {@link AgentWorkbenchLoadingBody} receives. */
type AgentWorkbenchLoadingBodyProps = { readonly words: WorkbenchLoadingWords }

/**
 * The workbench of the agent in the address, drawn while its route loads. The layout is chosen per agent type exactly as the page chooses
 * it (the spec of the type, else its registered workbench, else the pending notice), with the type, the instance and the view read from
 * the address, because a loading boundary receives no params; the blocks then draw their own skeletons.
 */
export const AgentWorkbenchLoadingBody = (props: AgentWorkbenchLoadingBodyProps): ReactElement | null => {
    const route = useAgentRoute()
    const query = useSearchParams()
    const tab = query.get("tab") || null
    const resolved = workbenchSpec(route.module)
    if (resolved !== null) {
        return (
            <SpecWorkbenchFrame
                module={route.module}
                installationId={route.installationId}
                spec={resolved.spec}
                fallback={resolved.fallback}
                tab={tab}
            />
        )
    }
    return (
        <AgentWorkbenchPageBase
            props={{
                ...props.words.pending,
                setupHref: workspaceHref(route.workspaceId, agentHref(route.module, route.installationId)),
            }}
        />
    )
}
