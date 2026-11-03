import { Component } from "react"
import type { ReactNode } from "react"
import { EmptyNotice } from "@starci/grammar/common"

/** What the boundary of one node takes. */
export interface NodeBoundaryProps {
    readonly message: string
    readonly retryLabel: string
    /** Called once per crash, so the host can report it. */
    readonly onCrash: () => void
    readonly children: ReactNode
}

/** Whether the node crashed. */
interface NodeBoundaryState {
    readonly hasCrashed: boolean
}

/** Catches a crashing block in its own place: the rest of the view stands. */
export class NodeBoundary extends Component<NodeBoundaryProps, NodeBoundaryState> {
    override state: NodeBoundaryState = { hasCrashed: false }

    static getDerivedStateFromError(): NodeBoundaryState {
        return { hasCrashed: true }
    }

    override componentDidCatch(): void {
        this.props.onCrash()
    }

    override render(): ReactNode {
        if (!this.state.hasCrashed) return this.props.children
        return (
            <EmptyNotice
                message={this.props.message}
                actionLabel={this.props.retryLabel}
                onAction={() => this.setState({ hasCrashed: false })}
            />
        )
    }
}
