import { ConnectionPageLoading } from "@/components/composites/ConnectionPageLoading"
import type { ConnectionPageLoadingProps } from "@/components/composites/ConnectionPageLoading"

/** STATE-8: the Telegram bot page with no data yet, in the frame of the page itself. */
export const TelegramConnectionLoadingPageBase = (props: ConnectionPageLoadingProps) => (
    <ConnectionPageLoading {...props} />
)
