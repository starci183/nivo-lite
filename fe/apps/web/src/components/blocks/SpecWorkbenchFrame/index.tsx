"use client"

import { coreBlocks } from "@nivo-lite/blocks-core/client"
import type { StoredSpec } from "@nivo-lite/agent-sdk/spec"
import { useWorkbenchDeclaration } from "@/hooks/workbenchSpec"
import { SpecWorkbenchFrameBase } from "./component"

/** What the route hands the frame: the module, its spec and where the route opens it. */
type SpecWorkbenchFrameProps = {
    readonly module: string
    readonly title: string
    readonly spec: StoredSpec
    readonly fallback: StoredSpec | null
    readonly installationId: string
    readonly tab: string | null
}

/** The connected workbench: finds the declaration of the module, whose reads and actions the spec binds, and draws the spec. */
export const SpecWorkbenchFrame = (props: SpecWorkbenchFrameProps) => {
    const declaration = useWorkbenchDeclaration(props.module)
    if (declaration === null) return null
    return (
        <SpecWorkbenchFrameBase
            props={{
                title: props.title,
                spec: props.spec,
                fallback: props.fallback,
                renderers: coreBlocks,
                reads: declaration.reads,
                actions: declaration.actions,
                permissions: declaration.permissions,
                namespace: declaration.namespace,
                installationId: props.installationId,
                tab: props.tab,
            }}
        />
    )
}
