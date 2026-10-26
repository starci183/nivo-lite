import { Badge, Button, RelativeTime, SurfaceCard, Text } from "@starci/grammar/common"
import { ACTIONS, STACK } from "./classNames"

/** Copy and state of the sync card of an agent. */
export interface AgentSyncCardBaseProps {
    readonly props: {
        readonly title: string
        /** The line's words; where it names when the copy was checked, the moment stands in `{time}`. */
        readonly lineText: string
        /** When the copy was last checked (RFC 3339); null when the line names no moment. */
        readonly lineCheckedAt: string | null
        readonly locale: string
        readonly lineTone: "success" | "warning" | "danger" | "neutral"
        readonly resyncLabel: string
        readonly isResyncDisabled: boolean
        readonly isQueuing: boolean
        readonly help: string
    }
    readonly on: { readonly resync: () => void }
}

/** Draws the OpenClaw copy of an agent quietly: which version it holds and when it was checked, with a button to sync again. */
export const AgentSyncCardBase = (props: AgentSyncCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={STACK}>
            <div className={ACTIONS} aria-live="polite">
                <Badge isDot tone={props.props.lineTone}>
                    {props.props.lineCheckedAt === null ? (
                        props.props.lineText
                    ) : (
                        <RelativeTime
                            dateTime={props.props.lineCheckedAt}
                            locale={props.props.locale}
                            template={props.props.lineText}
                            fallback={props.props.lineText.replace("{time}", "")}
                        />
                    )}
                </Badge>
                <Button
                    intent="neutral"
                    size="sm"
                    isPending={props.props.isQueuing}
                    isDisabled={props.props.isResyncDisabled}
                    onPress={props.on.resync}
                >
                    {props.props.resyncLabel}
                </Button>
            </div>
            <Text size="xs" tone="muted">
                {props.props.help}
            </Text>
        </div>
    </SurfaceCard>
)
