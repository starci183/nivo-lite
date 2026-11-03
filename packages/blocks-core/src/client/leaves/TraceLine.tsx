import type { ReactNode } from "react"
import { Cluster, Link, Text } from "@starci/grammar/common"
import type { TraceView } from "../../views/views.types"

/** The trace line of a row and the words of its link. */
interface TraceLineProps {
    readonly trace: TraceView
    readonly seeWhyLabel: string
}

/** Under a row: which branch decided it (or, with no branch, the gate's reason), and "See why" when a decision is recorded. */
export const TraceLine = (props: TraceLineProps): ReactNode => (
    <Cluster gap="inline">
        <Text size="xs" tone="muted">
            {props.trace.line}
        </Text>
        {props.trace.whyHref === null ? null : <Link href={props.trace.whyHref}>{props.seeWhyLabel}</Link>}
    </Cluster>
)
