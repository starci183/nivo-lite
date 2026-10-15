import { ErrorNotice } from "@/components/composites/ErrorNotice"

/** Props for the pure error page. */
export type LandingErrorPageBaseProps = {
    readonly props: { readonly title: string; readonly retryLabel: string }
    readonly on: { readonly retry: () => void }
}

/** Draws the locale segment's recoverable failure. */
export const LandingErrorPageBase = (props: LandingErrorPageBaseProps) => (
    <ErrorNotice title={props.props.title} retryLabel={props.props.retryLabel} onRetry={props.on.retry} />
)
