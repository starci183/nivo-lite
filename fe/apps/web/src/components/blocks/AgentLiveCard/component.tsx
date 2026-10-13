import { Badge, SurfaceCard, Switch, Text } from "@starci/grammar/common"
import { STACK } from "./classNames"

/** Copy and state of the live card. */
export interface AgentLiveCardBaseProps {
    readonly props: {
        readonly title: string
        readonly switchLabel: string
        readonly isLive: boolean
        readonly statusLabel: string
        readonly help: string
        /** Why the agent cannot go live yet; empty when it can. */
        readonly blocker: string
        readonly isDisabled: boolean
        readonly isLoading: boolean
    }
    readonly on: { readonly live: (on: boolean) => void }
}

/** Draws the live card: the switch, the status badge and what it needs before it can go live. */
export const AgentLiveCardBase = (props: AgentLiveCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={STACK}>
            <Switch
                name="live"
                label={props.props.switchLabel}
                isSelected={props.props.isLive}
                isSkeleton={props.props.isLoading}
                isDisabled={props.props.isDisabled}
                onSelectedChange={props.on.live}
            />
            <Badge isDot isSkeleton={props.props.isLoading} tone={props.props.isLive ? "success" : "neutral"}>
                {props.props.statusLabel}
            </Badge>
            <Text size="sm" tone="muted">
                {props.props.help}
            </Text>
            {props.props.blocker === "" ? null : <Text size="sm">{props.props.blocker}</Text>}
        </div>
    </SurfaceCard>
)
