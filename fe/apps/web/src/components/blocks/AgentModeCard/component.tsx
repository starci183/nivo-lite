import { SegmentedControl, SurfaceCard, Text } from "@starci/grammar/common"
import { STACK } from "./classNames"

/** Copy and state of the operating mode card. */
export interface AgentModeCardBaseProps {
    readonly props: {
        readonly title: string
        readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly mode: string
        readonly help: string
        readonly note: string
        /** Authority is shared by every instance of the type; empty for a single instance agent. */
        readonly sharedNote: string
        readonly isDisabled: boolean
        readonly isLoading: boolean
    }
    readonly on: { readonly mode: (value: string) => void }
}

/** Draws the operating mode card: assist or autopilot, and what each means. */
export const AgentModeCardBase = (props: AgentModeCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={STACK}>
            <SegmentedControl
                label={props.props.title}
                isLabelHidden
                options={props.props.options}
                value={props.props.mode}
                isSkeleton={props.props.isLoading}
                isDisabled={props.props.isDisabled}
                onValueChange={props.on.mode}
            />
            <Text size="sm" isSkeleton={props.props.isLoading}>
                {props.props.help}
            </Text>
            <Text size="xs" tone="muted">
                {props.props.note}
            </Text>
            {props.props.sharedNote === "" ? null : (
                <Text size="xs" tone="muted">
                    {props.props.sharedNote}
                </Text>
            )}
        </div>
    </SurfaceCard>
)
