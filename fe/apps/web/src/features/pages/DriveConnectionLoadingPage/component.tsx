import { ConnectionPageLoading } from "@/components/blocks/ConnectionPageLoading"
import type { ConnectionPageLoadingProps } from "@/components/blocks/ConnectionPageLoading"

/** STATE-8: the body of the Google account page with no data yet (the layout band is already there): the shared connection loading shape. */
export const DriveConnectionLoadingPageBase = (props: ConnectionPageLoadingProps) => <ConnectionPageLoading {...props} />
