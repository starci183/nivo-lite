import { ConnectionPageLoading } from "@/components/blocks/ConnectionPageLoading"
import type { ConnectionPageLoadingProps } from "@/components/blocks/ConnectionPageLoading"

/** STATE-8: the Google Drive page with no data yet, in the frame of the page itself. */
export const DriveConnectionLoadingPageBase = (props: ConnectionPageLoadingProps) => (
    <ConnectionPageLoading {...props} />
)
