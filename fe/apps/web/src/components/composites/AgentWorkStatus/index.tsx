import { Alert, Badge, Text } from "@starci/grammar/common"
import type { PresentationState } from "@starci/grammar/common"
import type { AgentWorkStatusView } from "@/modules/types"
import { FACTS } from "./classNames"

/** The status band of the Work tab. */
interface AgentWorkStatusProps {
    readonly status: AgentWorkStatusView
    readonly isSkeleton: boolean
}

const ALERT_TONE: Readonly<Record<AgentWorkStatusView["tone"], PresentationState>> = {
    neutral: "informative",
    accent: "informative",
    success: "affirmative",
    warning: "cautionary",
    danger: "negative",
    muted: "informative",
}

/** The facts beside the status that have words; one with none is left out. */
const factsOf = (status: AgentWorkStatusView): ReadonlyArray<{ readonly id: string; readonly text: string }> =>
    [
        { id: "next", text: status.nextRunLabel },
        { id: "queue", text: status.queueLabel },
    ].filter((fact) => fact.text !== "")

/** The status in words, the next run, the queue, and the reason work is stopped when it is. */
export const AgentWorkStatus = (props: AgentWorkStatusProps) => (
    <>
        <div className={FACTS}>
            <Badge isDot isSkeleton={props.isSkeleton} tone={props.status.tone}>
                {props.status.label}
            </Badge>
            {factsOf(props.status).map((fact) => (
                <Text key={fact.id} size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                    {fact.text}
                </Text>
            ))}
        </div>
        {props.status.stopNotice === "" ? null : (
            <Alert title={props.status.stopNotice} tone={ALERT_TONE[props.status.tone]} appearance="soft" />
        )}
    </>
)
