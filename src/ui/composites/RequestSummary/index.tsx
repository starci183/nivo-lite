import { Button, Text } from "@starci/grammar/common";



/** Resolved identity and optional onward action for one submitted request. */
export type RequestSummaryData = { readonly subject: string; readonly detail: string; readonly actionLabel?: string }
/** Action reported by the request summary. */
export type RequestSummaryActions = { readonly press?: () => void }
/** Props for the request summary. */
export type RequestSummaryProps = { readonly props: RequestSummaryData; readonly on?: RequestSummaryActions; readonly isLoading?: boolean }

/** Render a request subject, detail, and optional action. */
export const RequestSummary = (props: RequestSummaryProps) => (
    <div>
        <div>
            <Text size="sm" weight="semibold" isSkeleton={props.isLoading}>{props.props.subject}</Text>
            <Text size="xs" tone="muted" isSkeleton={props.isLoading}>{props.props.detail}</Text>
        </div>
        {props.props.actionLabel === undefined ? null : <Button variant="secondary" size="sm" isSkeleton={props.isLoading} onPress={props.on?.press}>{props.props.actionLabel}</Button>}
    </div>
)
