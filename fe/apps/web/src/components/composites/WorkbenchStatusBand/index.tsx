import { Badge, StatusDot, SurfaceCard, Text } from "@starci/grammar/common"
import type { WorkbenchBandView } from "@/modules/types"
import { BAND_CLASS_NAME, BAND_END_CLASS_NAME, BAND_START_CLASS_NAME } from "./classNames"

/** The status band and its accessible name; `isSkeleton` draws the same band with blank geometry while the facts are read. */
export interface WorkbenchStatusBandProps {
    readonly label: string
    readonly view: WorkbenchBandView
    readonly isSkeleton: boolean
}

/** One line of facts above the workbench: what the agent is doing, in which mode and version, when it last did something, and on which channels. */
export const WorkbenchStatusBand = (props: WorkbenchStatusBandProps) => {
    const view = props.view
    return (
        <SurfaceCard ariaLabel={props.label}>
            <div className={BAND_CLASS_NAME}>
                <div className={BAND_START_CLASS_NAME}>
                    {view.state === null ? null : view.state.isEchoing ? (
                        <StatusDot tone={view.state.tone} echo aria-label={view.state.label} />
                    ) : (
                        <StatusDot tone={view.state.tone} isSkeleton={props.isSkeleton}>
                            {view.state.label}
                        </StatusDot>
                    )}
                    {view.state !== null && view.state.isEchoing ? (
                        <Text size="sm" weight="semibold" isSkeleton={props.isSkeleton}>
                            {view.state.label}
                        </Text>
                    ) : null}
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
