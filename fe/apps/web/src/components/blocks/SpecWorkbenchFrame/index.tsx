"use client"

import { useEnabledModules } from "@nivo-lite/agent-sdk/client"
import type { StoredSpec } from "@nivo-lite/agent-sdk/spec"
import { useWorkbenchDeclaration, useWorkbenchInstallation } from "@/hooks/workbenchSpec"
import { SpecWorkbenchFrameBase } from "./component"

/** What the route hands the frame: the module, its spec and the view the route opens. */
type SpecWorkbenchFrameProps = {
    readonly module: string
    readonly title: string
    readonly spec: StoredSpec
    readonly fallback: StoredSpec | null
    readonly tab: string | null
}

/** The connected workbench: finds the declaration of the module, whose reads and actions the spec binds, and draws the spec on the module's installation when the module is enabled for the workspace. */
export const SpecWorkbenchFrame = (props: SpecWorkbenchFrameProps) => {
    const declaration = useWorkbenchDeclaration(props.module)
    const enabled = useEnabledModules()
    const installationId = useWorkbenchInstallation(props.module)
    if (declaration === null || installationId === null || !enabled.includes(props.module)) return null
    return (
        <SpecWorkbenchFrameBase
            props={{
                title: props.title,
                spec: props.spec,
                fallback: props.fallback,
                reads: declaration.reads,
                actions: declaration.actions,
                permissions: declaration.permissions,
                namespace: declaration.namespace,
                installationId,
                tab: props.tab,
            }}
        />
    )
}
