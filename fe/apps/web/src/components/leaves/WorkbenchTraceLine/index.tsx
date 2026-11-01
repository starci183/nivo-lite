import { Cluster, Text, TextAction } from "@starci/grammar/common"
import type { WorkbenchTraceView } from "@/modules/types"

/** The trace line of a row and the words of its link. */
interface WorkbenchTraceLineProps {
    readonly trace: WorkbenchTraceView
    readonly seeWhyLabel: string
}

/** Under a row: which branch decided it (or, with no branch, the gate's reason), and "See why" when a decision is recorded. */
export const WorkbenchTraceLine = (props: WorkbenchTraceLineProps) => (
    <Cluster gap="inline">
        <Text size="xs" tone="muted">
            {props.trace.line}
        </Text>
        {props.trace.whyHref === null ? null : (
            <TextAction size="sm" href={props.trace.whyHref}>
                {props.seeWhyLabel}
            </TextAction>
        )}
    </Cluster>
)
