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

/** The status in words, the next run, the queue, and the reason work is stopped when it is. */
export const AgentWorkStatus = (props: AgentWorkStatusProps) => (
    <>
        <div className={FACTS}>
            <Badge isDot isSkeleton={props.isSkeleton} tone={props.status.tone}>
                {props.status.label}
            </Badge>
            <Text size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                {props.status.nextRunLabel}
            </Text>
            <Text size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                {props.status.queueLabel}
            </Text>
        </div>
        {props.status.stopNotice === "" ? null : (
            <Alert title={props.status.stopNotice} tone={ALERT_TONE[props.status.tone]} appearance="soft" />
        )}
    </>
)
