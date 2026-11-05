import type { StoredSpec } from "@nivo-lite/agent-sdk/spec"
import { SpecWorkbenchFrame } from "@/components/blocks/SpecWorkbenchFrame"

/** The workbench of one module as its spec draws it. */
export interface SpecWorkbenchPageBaseProps {
    readonly props: {
        readonly module: string
        readonly spec: StoredSpec
        readonly fallback: StoredSpec | null
        readonly tab: string | null
    }
}

/** Mounts the connected workbench with the spec the server resolved. */
export const SpecWorkbenchPageBase = (props: SpecWorkbenchPageBaseProps) => <SpecWorkbenchFrame {...props.props} />
