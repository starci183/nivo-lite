import { Badge, StatusDot, SurfaceCard, Text } from "@starci/grammar/common"
import type { WorkbenchBandView } from "@/modules/types"
import { BAND_CLASS_NAME, BAND_END_CLASS_NAME, BAND_START_CLASS_NAME } from "./classNames"

/** The status band and its accessible name; `isSkeleton` draws the same band with blank geometry while the facts are read. */
interface WorkbenchStatusBandProps {
    readonly label: string
    readonly view: WorkbenchBandView
    readonly isSkeleton: boolean
}

/** The state to draw and whether it is still being read. */
interface StateMarkProps {
    readonly state: WorkbenchBandView["state"]
    readonly isSkeleton: boolean
}

/** The state of the agent: a dot with its words, or an echoing dot beside bold words while it works. */
const StateMark = (props: StateMarkProps) => {
    const state = props.state
    if (state === null) return null
    if (!state.isEchoing) {
        return (
            <StatusDot tone={state.tone} isSkeleton={props.isSkeleton}>
                {state.label}
            </StatusDot>
        )
    }
    return (
        <>
            <StatusDot tone={state.tone} echo aria-label={state.label} />
            <Text size="sm" weight="semibold" isSkeleton={props.isSkeleton}>
                {state.label}
            </Text>
        </>
    )
}

/** One line of facts above the workbench: what the agent is doing, in which mode and version, when it last did something, and on which channels. */
export const WorkbenchStatusBand = (props: WorkbenchStatusBandProps) => {
    const view = props.view
    return (
        <SurfaceCard ariaLabel={props.label}>
            <div className={BAND_CLASS_NAME}>
                <div className={BAND_START_CLASS_NAME}>
                    <StateMark state={view.state} isSkeleton={props.isSkeleton} />
                    {view.mode === null ? null : (
                        <Badge tone={view.mode.tone} isDot isSkeleton={props.isSkeleton}>
                            {view.mode.label}
                        </Badge>
                    )}
                    {view.version === null ? null : (
                        <Text size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                            {view.version}
                        </Text>
                    )}
                </div>
                <div className={BAND_END_CLASS_NAME}>
                    <Text size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                        {view.lastActivity}
                    </Text>
                    {view.channels.map((channel) => (
                        <Badge
                            key={channel.id}
                            tone={channel.isMissing ? "warning" : "neutral"}
                            isSkeleton={props.isSkeleton}
                        >
                            {channel.label}
                        </Badge>
                    ))}
                </div>
            </div>
        </SurfaceCard>
    )
}
