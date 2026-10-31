import { ConnectionPageLoading } from "@/components/composites/ConnectionPageLoading"
import type { ConnectionPageLoadingProps } from "@/components/composites/ConnectionPageLoading"

/** STATE-8: the Google Drive page with no data yet, in the frame of the page itself. */
export const DriveConnectionLoadingPageBase = (props: ConnectionPageLoadingProps) => (
    <ConnectionPageLoading {...props} />
)
