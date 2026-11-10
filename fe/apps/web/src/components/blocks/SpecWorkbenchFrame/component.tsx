import { SpecWorkbench } from "@nivo-lite/agent-sdk/client"
import type { ActionDefinition, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { PageFrameTabs } from "@nivo-lite/agent-sdk/client"
import type { StoredSpec } from "@nivo-lite/agent-sdk/spec"

/** Resolved atoms of one workbench: its spec and what the spec may bind. */
export interface SpecWorkbenchFrameBaseProps {
    readonly props: {
        readonly spec: StoredSpec
        readonly fallback: StoredSpec | null
        readonly reads: ReadonlyArray<ReadDefinition>
        readonly actions: ReadonlyArray<ActionDefinition>
        readonly permissions: ReadonlyArray<string>
        readonly namespace: string
        readonly installationId: string
        /** The view the route names; null opens the first visible view. */
        readonly tab: string | null
        /** The frame around the workbench takes its view tabs for its header; null outside one. */
        readonly tabsSink: ((tabs: PageFrameTabs | null) => void) | null
    }
}

/** The spec drawn with the blocks the host mounted at the app root installed, which also serves every port; the agent frame around it owns the page. */
export const SpecWorkbenchFrameBase = (props: SpecWorkbenchFrameBaseProps) => (
    <SpecWorkbench
        spec={props.props.spec}
        fallback={props.props.fallback}
        reads={props.props.reads}
        actions={props.props.actions}
        permissions={props.props.permissions}
        namespace={props.props.namespace}
        route={{ installationId: props.props.installationId, tab: props.props.tab }}
        canManage={false}
        {...(props.props.tabsSink === null ? {} : { tabsSink: props.props.tabsSink })}
    />
)
