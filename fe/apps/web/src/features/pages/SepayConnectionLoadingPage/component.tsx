import { ConnectionPageLoading, type ConnectionPageLoadingProps } from "@/components/blocks/ConnectionPageLoading"

/** STATE-8: the SePay page with no data yet, in the frame of the page itself. */
export const SepayConnectionLoadingPageBase = (props: ConnectionPageLoadingProps) => (
    <ConnectionPageLoading {...props} />
)
