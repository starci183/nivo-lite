"use client"

import { useEnabledModules } from "@nivo-lite/agent-sdk/client"
import type { StoredSpec } from "@nivo-lite/agent-sdk/spec"
import { useProviderReads, useWorkbenchDeclaration } from "@/hooks/workbenchSpec"
import { useWorkbenchTabsSink } from "@/hooks/workbenchTabs"
import { SpecWorkbenchFrameBase } from "./component"

/** The module every installation has: its reads (the runs it parked) and actions (resume one) a spec of any module may bind. */
const PLATFORM_MODULE_KEY = "platform"

/** What the route hands the frame: the module, the installation of the url, its spec and the view the route opens. */
type SpecWorkbenchFrameProps = {
    readonly module: string
    readonly installationId: string
    readonly spec: StoredSpec
    readonly fallback: StoredSpec | null
    readonly tab: string | null
    /** The page is one view of the spec on a page of its own (a data page): the view draws no tab row, in its own band or in the frame's header. */
    readonly isBare?: boolean
}

/** Takes the tab row of a bare view and draws nothing. */
const NO_TABS = (): void => undefined

/** The connected workbench: finds the declaration of the module, whose reads and actions the spec binds, and draws the spec on the installation of the url when the module is enabled for the workspace (the platform module is always there). */
export const SpecWorkbenchFrame = (props: SpecWorkbenchFrameProps) => {
    const declaration = useWorkbenchDeclaration(props.module)
    const platform = useWorkbenchDeclaration(PLATFORM_MODULE_KEY)
    const enabled = useEnabledModules()
    const frameSink = useWorkbenchTabsSink()
    const providerReads = useProviderReads(props.spec, props.fallback)
    const tabsSink = props.isBare === true ? NO_TABS : frameSink
    const isPlatform = props.module === PLATFORM_MODULE_KEY
    if (declaration === null || platform === null || !(isPlatform || enabled.includes(props.module))) return null
    return (
        <SpecWorkbenchFrameBase
            props={{
                spec: props.spec,
                fallback: props.fallback,
                reads: [...declaration.reads, ...platform.reads, ...providerReads],
                actions: [...declaration.actions, ...platform.actions],
                permissions: declaration.permissions,
                namespace: declaration.namespace,
                installationId: props.installationId,
                tab: props.tab,
                tabsSink,
            }}
        />
    )
}
