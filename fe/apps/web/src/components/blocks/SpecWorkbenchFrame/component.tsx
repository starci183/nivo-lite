import { SpecWorkbench } from "@nivo-lite/agent-sdk/client"
import { Page } from "@starci/grammar/common"
import type { ActionDefinition, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { StoredSpec } from "@nivo-lite/agent-sdk/spec"

/** Resolved atoms of one workbench: its spec and what the spec may bind. */
export interface SpecWorkbenchFrameBaseProps {
    readonly props: {
        readonly title: string
        readonly spec: StoredSpec
        readonly fallback: StoredSpec | null
        readonly reads: ReadonlyArray<ReadDefinition>
        readonly actions: ReadonlyArray<ActionDefinition>
        readonly permissions: ReadonlyArray<string>
        readonly namespace: string
        readonly installationId: string
        /** The view the route path names; null opens the first visible view. */
        readonly tab: string | null
    }
}

/** The page of a workbench: its heading over the spec drawn with the blocks the host mounted at the app root installed, which also serves every port. */
export const SpecWorkbenchFrameBase = (props: SpecWorkbenchFrameBaseProps) => (
    <Page header={{ title: props.props.title }}>
        <SpecWorkbench
            spec={props.props.spec}
            fallback={props.props.fallback}
            reads={props.props.reads}
            actions={props.props.actions}
            permissions={props.props.permissions}
            namespace={props.props.namespace}
            route={{ installationId: props.props.installationId, tab: props.props.tab }}
            canManage={false}
        />
    </Page>
)
