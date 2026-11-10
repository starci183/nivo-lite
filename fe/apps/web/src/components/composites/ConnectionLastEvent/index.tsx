import { Cluster, RelativeTime, Text } from "@starci/grammar/common"

/** What the last event cell of a connection row reads. */
interface ConnectionLastEventProps {
    /** When the last event came, as an ISO date; null before the first one. */
    readonly at: string | null
    /** How the connection's last event ended: `failed` when it stopped on a failure. */
    readonly outcome: "failed" | "ok"
    readonly locale: string
    /** "failed" and the dash shown before the first event, in the reader's language. */
    readonly failedLabel: string
    readonly noneLabel: string
}

/** The last event cell of a connection row: when it came, that it failed, or a dash before the first one. */
export const ConnectionLastEvent = (props: ConnectionLastEventProps) => {
    if (props.at === null) {
        return (
            <Text size="sm" tone="muted">
                {props.outcome === "failed" ? props.failedLabel : props.noneLabel}
            </Text>
        )
    }
    return (
        <Cluster gap="identity">
            {props.outcome === "failed" ? (
                <Text size="sm" tone="muted">
                    {props.failedLabel}
                </Text>
            ) : null}
            <RelativeTime dateTime={props.at} locale={props.locale} size="sm" tone="muted" />
        </Cluster>
    )
}
