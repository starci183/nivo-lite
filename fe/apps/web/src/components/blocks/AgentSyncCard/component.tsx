import { Button, RelativeTime } from "@starci/grammar/common"
import { FieldBlock } from "@/components/frames/FieldBlock"

/** Copy and state of the copy-of-the-agent field. */
export interface AgentSyncCardBaseProps {
    readonly props: {
        /** The title: a short noun ("Running version"). */
        readonly title: string
        /** What the copy is doing, said first in the description: "Version 1", a failure, "not synced yet". */
        readonly lead: string
        /** When the copy was last checked (RFC 3339); null when no moment is named. */
        readonly checkedAt: string | null
        /** The words around the moment; the moment stands in `{time}` ("synced {time}"). */
        readonly checkedTemplate: string
        /** The standing note that closes the description ("updates itself every 5 minutes"). */
        readonly autoNote: string
        readonly locale: string
        readonly resyncLabel: string
        readonly isResyncDisabled: boolean
        readonly isQueuing: boolean
    }
    readonly on: { readonly resync: () => void }
}

/** Draws the OpenClaw copy of an agent as one flat field: the running version and when it was checked, with the sm sync button at the right. */
export const AgentSyncCardBase = (props: AgentSyncCardBaseProps) => (
    <FieldBlock
        title={props.props.title}
        description={
            <>
                {props.props.lead}
                {" · "}
                {props.props.checkedAt === null ? null : (
                    <>
                        <RelativeTime
                            dateTime={props.props.checkedAt}
                            locale={props.props.locale}
                            template={props.props.checkedTemplate}
                            fallback=""
                        />
                        {" · "}
                    </>
                )}
                {props.props.autoNote}
            </>
        }
        trailing={
            <Button
                intent="neutral"
                size="sm"
                isPending={props.props.isQueuing}
                isDisabled={props.props.isResyncDisabled}
                onPress={props.on.resync}
            >
                {props.props.resyncLabel}
            </Button>
        }
    />
)
